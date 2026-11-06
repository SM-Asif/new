import CronJob from 'node-cron';
import { runCrawler } from '../crawler/index.js';
import { evaluatePendingDomains } from '../domain/index.js';
import { db, now, log } from '../db/index.js';

const jobs = new Map(); // jobId -> { task, stop: false, controller }

export function startScheduler(io) {
  function emit(jobId, event) {
    io?.to(`job:${jobId}`)?.emit?.('event', event);
    io?.emit?.('event', { ...event, jobId });
  }

  async function runJob(jobId) {
    const job = db.get(`SELECT * FROM crawl_jobs WHERE id = ?`, [jobId]);
    if (!job) return;
    if (job.status === 'running') return;

    db.run(`UPDATE crawl_jobs SET status = 'running', updated_at = ? WHERE id = ?`, [now(), jobId]);
    emit(jobId, { type: 'status', status: 'running', jobId, timestamp: now() });

    const stopSignal = () => {
      const cur = jobs.get(jobId);
      return cur && cur.stop === true;
    };

    try {
      const jobConfig = {
        ...job,
        countries: JSON.parse(job.countries || '[]'),
        keywords: JSON.parse(job.keywords || '[]'),
        brands: JSON.parse(job.brands || '[]'),
        tlds: JSON.parse(job.tlds || '[]'),
      };

      await runCrawler(jobConfig, (event) => emit(jobId, event), stopSignal);

      // after crawl, evaluate domains
      emit(jobId, { type: 'status', status: 'evaluating', jobId, timestamp: now() });
      await evaluatePendingDomains(jobId, jobConfig.countries, jobConfig.keywords, jobConfig.brands, 4, stopSignal);

      db.run(`UPDATE crawl_jobs SET status = 'idle', updated_at = ? WHERE id = ?`, [now(), jobId]);
      emit(jobId, { type: 'status', status: 'idle', jobId, timestamp: now() });
      log({ jobId, level: 'info', message: 'Crawl job cycle complete' });
    } catch (e) {
      log({ jobId, level: 'error', message: `Job error: ${e.message}` });
      db.prepare(`UPDATE crawl_jobs SET status = 'error', updated_at = ? WHERE id = ?`).run(now(), jobId);
      emit(jobId, { type: 'status', status: 'error', jobId, error: e.message, timestamp: now() });
    }
  }

  return {
    addJob(jobId) {
      if (jobs.has(jobId)) return;
      const entry = { stop: false };
      jobs.set(jobId, entry);

      // Continuous mode: run immediately, then loop while not stopped
      const loop = async () => {
        while (!entry.stop) {
          await runJob(jobId);
          if (entry.stop) break;
          // wait 5 minutes between cycles
          await new Promise(r => setTimeout(r, 5 * 60 * 1000));
        }
      };
      loop().catch(() => {});
      return entry;
    },
    stopJob(jobId) {
      const entry = jobs.get(jobId);
      if (entry) entry.stop = true;
    },
    removeJob(jobId) {
      this.stopJob(jobId);
      jobs.delete(jobId);
    },
    isRunning(jobId) {
      const entry = jobs.get(jobId);
      return entry ? !entry.stop : false;
    },
  };
}
