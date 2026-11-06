import * as React from 'react';
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Card, StatCard } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Card';
import { Badge } from '../components/ui/Card';
import { Target, Play, Square, Trash2, Plus } from 'lucide-react';

export const Jobs = () => {
  const { jobs, setJobs, updateJobStatus } = useStore();
  const [form, setForm] = useState({ name: '', seedUrl: '', maxPages: 5000, maxDepth: 4, concurrency: 6, delayMs: 200 });
  const [open, setOpen] = useState(false);

  useEffect(() => { api.getJobs().then(setJobs); }, []);

  const createJob = async () => {
    await api.createJob({ ...form, countries: [], keywords: [], brands: [], tlds: [] });
    setForm({ name: '', seedUrl: '', maxPages: 5000, maxDepth: 4, concurrency: 6, delayMs: 200 });
    setOpen(false);
    api.getJobs().then(setJobs);
  };

  const statusBadge = (s: string) => {
    const v = { running: 'bg-brand-600/20 text-brand-400', idle: 'bg-white/10 text-ink-400', stopped: 'bg-red-600/20 text-red-400', error: 'bg-red-600/20 text-red-400' }[s] || 'bg-white/10 text-ink-400';
    return <Badge variant="neutral" className={v}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">Crawl jobs</h2>
          <p className="text-ink-400">Schedule continuous crawling of news websites. Jobs run while your PC is on.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> New job</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-ink-500 text-xs uppercase">
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Seed URL</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Pages</th>
                <th className="px-4 py-3 font-medium text-right">Domains</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-ink-300">{j.name}</td>
                  <td className="px-4 py-3 text-xs text-ink-500 truncate max-w-xs">{j.seed_url}</td>
                  <td className="px-4 py-3">{statusBadge(j.status)}</td>
                  <td className="px-4 py-3 text-right text-ink-300">{j.pages_crawled}</td>
                  <td className="px-4 py-3 text-right text-ink-300">{j.domains_found}</td>
                  <td className="px-4 py-3 text-right">
                    {j.status === 'running' ? (
                      <Button variant="ghost" size="sm" onClick={() => { api.stopJob(j.id).then(() => updateJobStatus(j.id, 'stopped')); }} className="text-xs px-2 py-1.5"><Square className="w-3 h-3 mr-1" /></Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => { api.startJob(j.id).then(() => updateJobStatus(j.id, 'running')); api.getJobs().then(setJobs); }} className="text-xs px-2 py-1.5"><Play className="w-3 h-3 mr-1" /></Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => { if(window.confirm('Delete job?')){ api.deleteJob(j.id).then(() => setJobs(jobs.filter(x => x.id !== j.id))); } }} className="text-xs px-2 py-1.5"><Trash2 className="w-3 h-3" /></Button>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-500">No crawl jobs yet. Create one to start discovering domains.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {open && (
        <Card className="p-6 max-w-md mx-auto mt-6">
          <h3 className="font-medium text-white mb-4">New crawl job</h3>
          <Input label="Job name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Seed news URL" value={form.seedUrl} onChange={e => setForm({ ...form, seedUrl: e.target.value })} placeholder="https://example-news.com" />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label="Max pages" value={String(form.maxPages)} onChange={e => setForm({ ...form, maxPages: parseInt(e.target.value) || 0 })} type="number" />
            <Input label="Max depth" value={String(form.maxDepth)} onChange={e => setForm({ ...form, maxDepth: parseInt(e.target.value) || 0 })} type="number" />
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createJob}>Create job</Button>
          </div>
        </Card>
      )}
    </div>
  );
};
