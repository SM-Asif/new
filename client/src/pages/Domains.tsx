import * as React from 'react';
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Card';
import { Input } from '../components/ui/Card';
import { DomainRow } from '../components/DomainRow';
import { Globe, Filter, RefreshCw, Trash2, Download } from 'lucide-react';

export const Domains = () => {
  const { domains, setDomains, setStats, stats } = useStore();
  const [filters, setFilters] = useState({ jobId: '', available: '', q: '', minScore: '' });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [d, s] = await Promise.all([api.getDomains(filters), api.getStats({ jobId: filters.jobId || undefined })]);
    setDomains(d);
    setStats(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters.jobId, filters.available, filters.q, filters.minScore]);

  const handleRecheck = async (id: string) => {
    const res = await api.recheckDomains([id]);
    if (res.ok) load();
  };

  const handleClear = async () => {
    if (!window.confirm('Clear domains older than 30 days?')) return;
    await api.clearData({ olderThanDays: 30, domains: 1, logs: 0, pages: 0 });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">Discovered domains</h2>
          <p className="text-ink-400">Candidate news domains found during crawling. Green = likely available.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
          <Button variant="danger" onClick={handleClear}><Trash2 className="w-4 h-4 mr-2" /> Clear old</Button>
          <Button variant="ghost"><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Input label="Filter by domain" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
          <select className="input" value={filters.available} onChange={e => setFilters({ ...filters, available: e.target.value })}>
            <option value="">All availability</option>
            <option value="true">Available only</option>
            <option value="false">Taken only</option>
          </select>
          <Input label="Min authority score" value={filters.minScore} onChange={e => setFilters({ ...filters, minScore: e.target.value })} type="number" />
          <Button variant="ghost" className="h-10" onClick={load}><Filter className="w-4 h-4" /></Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-ink-500 text-xs uppercase">
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Authority</th>
                <th className="px-4 py-3 font-medium">Industry</th>
                <th className="px-4 py-3 font-medium">Refs</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {domains.map(d => (
                <DomainRow key={d.id} domain={d} onRecheck={handleRecheck} />
              ))}
              {domains.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-ink-500">No domains found. Start a crawl job to discover news domains.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
