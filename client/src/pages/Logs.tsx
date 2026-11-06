import * as React from 'react';
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Card';
import { Search, Trash2 } from 'lucide-react';

export const Logs = () => {
  const { logs, setLogs } = useStore();
  const [jobId, setJobId] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => { api.getLogs({ jobId: jobId || undefined }).then(setLogs); }, [jobId]);

  const filtered = logs.filter(l => !q || (l.message && l.message.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-white">Crawl logs</h2>
        <p className="text-ink-400">Live log stream from crawl jobs.</p>
      </div>
      <Card>
        <div className="flex gap-3 mb-4">
          <Input label="Job ID" value={jobId} onChange={e => setJobId(e.target.value)} placeholder="optional" />
          <Input label="Search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search messages" />
          <button className="ml-auto btn-ghost" onClick={() => { api.getLogs({ jobId: jobId || undefined }).then(setLogs); }}>
            <Search className="w-4 h-4 mr-2" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 text-left text-ink-500 uppercase">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-white/5">
                  <td className="px-4 py-2 text-ink-500 font-mono">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-bold ${l.level === 'error' ? 'bg-red-600/20 text-red-400' : l.level === 'warn' ? 'bg-amber-600/20 text-amber-400' : 'bg-brand-600/20 text-brand-400'}`}>{l.level}</span></td>
                  <td className="px-4 py-2 text-ink-300">{l.message}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-ink-500">No logs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
