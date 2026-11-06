import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { db, now, log, init } from './db/index.js';
import { startScheduler } from './scheduler/index.js';
import { runCrawler } from './crawler/index.js';
import { evaluatePendingDomains, evaluateDomain } from './domain/index.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const scheduler = startScheduler(io);

io.on('connection', (socket) => {
  socket.on('join:job', (jobId) => { socket.join(`job:${jobId}`); });
  socket.on('leave:job', (jobId) => { socket.leave(`job:${jobId}`); });
});

// ---- Jobs ----
app.get('/api/jobs', (req, res) => {
  const rows = db.all(`SELECT *,
    (SELECT COUNT(*) FROM discovered_domains d WHERE d.job_id = crawl_jobs.id AND d.available = 1) AS available_count
    FROM crawl_jobs ORDER BY created_at DESC`);
  res.json(rows.map(r => ({ ...r, countries: JSON.parse(r.countries || '[]'), keywords: JSON.parse(r.keywords || '[]'), brands: JSON.parse(r.brands || '[]'), tlds: JSON.parse(r.tlds || '[]') })));
});

app.post('/api/jobs', (req, res) => {
  const {
    name, seedUrl, maxPages = 10000, maxDepth = 5, concurrency = 8, delayMs = 200,
    respectRobots = 1, useJs = 0, countries = [], keywords = [], brands = [], tlds = [],
  } = req.body || {};

  if (!name || !seedUrl) return res.status(400).json({ error: 'name and seedUrl required' });

  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('node:crypto').randomUUID();
  const ts = now();
  db.run(`INSERT INTO crawl_jobs (id, name, seed_url, status, max_pages, max_depth, concurrency, delay_ms, respect_robots, use_js, countries, keywords, brands, tlds, created_at, updated_at)
    VALUES (?,?,?, 'idle',?,?,?,?,?,?,?,?,?,?,?,?)`, [id, name, seedUrl, maxPages, maxDepth, concurrency, delayMs, respectRobots, useJs,
    JSON.stringify(countries), JSON.stringify(keywords), JSON.stringify(brands), JSON.stringify(tlds), ts, ts]);

  const job = db.get(`SELECT * FROM crawl_jobs WHERE id = ?`, [id]);
  log({ jobId: id, level: 'info', message: `Job created: ${name} (${seedUrl})` });

  scheduler.addJob(id);

  res.status(201).json({ ...job, countries: [], keywords: [], brands: [], tlds: [] });
});

app.post('/api/jobs/:id/start', (req, res) => {
  const { id } = req.params;
  const job = db.get(`SELECT * FROM crawl_jobs WHERE id = ?`, [id]);
  if (!job) return res.status(404).json({ error: 'not found' });
  scheduler.addJob(id);
  db.run(`UPDATE crawl_jobs SET status = 'running', updated_at = ? WHERE id = ?`, [now(), id]);
  io.to(`job:${id}`).emit('event', { type: 'status', status: 'running', jobId: id, timestamp: now() });
  res.json({ ok: true });
});

app.post('/api/jobs/:id/stop', (req, res) => {
  const { id } = req.params;
  scheduler.stopJob(id);
  db.run(`UPDATE crawl_jobs SET status = 'stopped', updated_at = ? WHERE id = ?`, [now(), id]);
  io.to(`job:${id}`).emit('event', { type: 'status', status: 'stopped', jobId: id, timestamp: now() });
  res.json({ ok: true });
});

app.delete('/api/jobs/:id', (req, res) => {
  const { id } = req.params;
  scheduler.removeJob(id);
  db.run(`DELETE FROM crawl_jobs WHERE id = ?`, [id]);
  res.json({ ok: true });
});

// ---- Domains ----
app.get('/api/domains', (req, res) => {
  const { jobId, available, q, minScore, country, sort = 'authority_score', order = 'desc', limit = 100, offset = 0 } = req.query;
  let sql = `SELECT * FROM discovered_domains WHERE 1=1`;
  const params = [];
  if (jobId) { sql += ` AND job_id = ?`; params.push(jobId); }
  if (available === 'true') { sql += ` AND available = 1`; }
  else if (available === 'false') { sql += ` AND (available = 0 OR available IS NULL)`; }
  if (q) { sql += ` AND (domain LIKE ? OR notes LIKE ?)`; params.push(`%${q}%`, `%${q}%`); }
  if (minScore) { sql += ` AND authority_score >= ?`; params.push(parseFloat(minScore)); }
  if (country) { sql += ` AND country = ?`; params.push(country); }
  const validSort = ['authority_score', 'news_industry_score', 'age_days', 'seen_count', 'first_seen', 'available'];
  const sortCol = validSort.includes(sort) ? sort : 'authority_score';
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${sortCol} ${dir} LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));
  const rows = db.all(sql, params);
  res.json(rows.map(r => ({
    ...r,
    dns_a: JSON.parse(r.dns_a || '[]'),
    dns_mx: JSON.parse(r.dns_mx || '[]'),
    dns_ns: JSON.parse(r.dns_ns || '[]'),
  })));
});

app.get('/api/domains/stats', (req, res) => {
  const { jobId } = req.query;
  const where = jobId ? `WHERE job_id = ?` : '';
  const params = jobId ? [jobId] : [];
  const total = db.get(`SELECT COUNT(*) AS c FROM discovered_domains ${where}`, params).c;
  const avail = db.get(`SELECT COUNT(*) AS c FROM discovered_domains ${where} AND available = 1`, params).c;
  const byScore = db.get(`SELECT
    SUM(CASE WHEN authority_score >= 70 THEN 1 ELSE 0 END) AS high,
    SUM(CASE WHEN authority_score >= 40 AND authority_score < 70 THEN 1 ELSE 0 END) AS medium,
    SUM(CASE WHEN authority_score < 40 THEN 1 ELSE 0 END) AS low
    FROM discovered_domains ${where}`, params);
  const top = db.all(`SELECT * FROM discovered_domains ${where} AND available = 1 ORDER BY authority_score DESC LIMIT 10`, params);
  res.json({ total, available: avail, taken: total - avail, byScore, top: top.map(r => ({ ...r, dns_a: JSON.parse(r.dns_a || '[]') })) });
});

app.post('/api/domains/recheck', async (req, res) => {
  const { ids } = req.body || {};
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.all(`SELECT id, domain, seen_count FROM discovered_domains WHERE id IN (${placeholders})`, ids);
  for (const row of rows) {
    try {
      const r = await evaluateDomain(row.id, row.domain, row.seen_count, [], [], []);
      io.emit('event', { type: 'domain_rechecked', domain: row.domain, ...r, jobId: null, timestamp: now() });
    } catch (e) { log({ level: 'error', message: `Recheck failed ${row.domain}: ${e.message}` }); }
  }
  res.json({ ok: true, count: rows.length });
});

// ---- Logs ----
app.get('/api/logs', (req, res) => {
  const { jobId, limit = 200 } = req.query;
  let rows;
  if (jobId) {
    rows = db.all(`SELECT * FROM crawl_logs WHERE job_id = ? ORDER BY created_at DESC LIMIT ?`, [jobId, parseInt(limit)]);
  } else {
    rows = db.all(`SELECT * FROM crawl_logs ORDER BY created_at DESC LIMIT ?`, [parseInt(limit)]);
  }
  res.json(rows);
});

// ---- Settings ----
app.get('/api/settings', (req, res) => {
  const rows = db.all(`SELECT * FROM settings`);
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key required' });
  const ts = now();
  db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, [key, value, ts]);
  res.json({ ok: true });
});

app.post('/api/settings/clear', (req, res) => {
  const { olderThanDays = 30, domains = 0, logs = 0, pages = 0 } = req.body || {};
  const ts = now();
  let removed = { domains: 0, logs: 0, pages: 0 };
  if (domains) {
    db.run(`DELETE FROM discovered_domains WHERE last_seen < ?`, [ts - olderThanDays * 86400000]);
    removed.domains = 1;
  }
  if (logs) {
    db.run(`DELETE FROM crawl_logs WHERE created_at < ?`, [ts - olderThanDays * 86400000]);
    removed.logs = 1;
  }
  if (pages) {
    db.run(`DELETE FROM crawled_pages WHERE fetched_at < ?`, [ts - olderThanDays * 86400000]);
    removed.pages = 1;
  }
  res.json({ ok: true, removed });
});

// ---- One-off crawl + evaluate ----
app.post('/api/crawl', async (req, res) => {
  const { seedUrl, maxPages = 1000, maxDepth = 3, concurrency = 6, useJs = 0, countries = [], keywords = [], brands = [] } = req.body || {};
  if (!seedUrl) return res.status(400).json({ error: 'seedUrl required' });
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('node:crypto').randomUUID();
  const ts = now();
  db.run(`INSERT INTO crawl_jobs (id, name, seed_url, status, max_pages, max_depth, concurrency, delay_ms, respect_robots, use_js, countries, keywords, brands, tlds, created_at, updated_at)
    VALUES (?,?,?, 'running',?,?,?,?,1,?,?,?,?,?,?,?)`, [id, 'One-off crawl', seedUrl, maxPages, maxDepth, concurrency, 200, useJs,
    JSON.stringify(countries), JSON.stringify(keywords), JSON.stringify(brands), JSON.stringify([]), ts, ts]);

  let finished = false;
  try {
    await runCrawler({
      id, name: 'One-off crawl', seedUrl, maxPages, maxDepth, concurrency, delayMs: 200,
      respectRobots: 1, useJs: !!useJs, countries, keywords, brands, tlds: [],
    }, (event) => io.to(`job:${id}`).emit('event', { ...event, jobId: id, timestamp: now() }), () => finished);
    await evaluatePendingDomains(id, countries, keywords, brands, 4, () => finished);
  } catch (e) { log({ jobId: id, level: 'error', message: e.message }); }
  finished = true;
  db.run(`UPDATE crawl_jobs SET status = 'idle', updated_at = ? WHERE id = ?`, [now(), id]);
  io.to(`job:${id}`).emit('event', { type: 'status', status: 'idle', jobId: id, timestamp: now() });
  res.json({ jobId: id });
});

const PORT = process.env.PORT || 4000;

await init();
httpServer.listen(PORT, () => {
  console.log(`News Domain Hunter server running on http://localhost:${PORT}`);
});
