import * as React from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Card, StatCard } from '../components/ui/Card';
import { CrawlChart, AuthorityPie } from '../components/CrawlChart';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Card';
import { Newspaper } from 'lucide-react';

export const Dashboard = () => {
  const { jobs: allJobs, setJobs, setStats, stats, setDomains, domains, setLogs } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    api.getJobs().then(setJobs);
    api.getStats().then(setStats);
  }, []);

  const handleStartOneOff = () => {
    const seed = window.prompt('Enter news website URL to crawl (e.g. https://example-news.com)');
    if (!seed) return;
    api.oneOffCrawl({ seedUrl: seed, maxPages: 2000, maxDepth: 3, concurrency: 6 })
      .then(() => navigate(`/jobs`));
  };

  const totalJobs = allJobs.length;
  const running = allJobs.filter(j => j.status === 'running').length;
  const totalDomains = stats.total || 0;
  const available = stats.available || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-ink-400">Find expired &amp; available news domains across the web.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleStartOneOff}><Newspaper className="w-4 h-4 mr-2" /> Quick crawl</Button>
          <Button variant="ghost" onClick={() => navigate('/jobs')}>Manage jobs</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Crawl jobs" value={totalJobs} sub="Active & scheduled" trend={running > 0 ? `${running} running` : 'Idle'} />
        <StatCard title="Total pages" value={stats.pagesCrawled || 0} sub="Articles crawled" />
        <StatCard title="Domains found" value={totalDomains} sub="Candidate domains" />
        <StatCard title="Available" value={available} sub="Ready to register" trend={available > 0 ? `+${available}` : '0'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CrawlChart data={[]} />
        </div>
        <div>
          <AuthorityPie data={[
            { name: 'High (70+)', value: stats.byScore?.high || 0 },
            { name: 'Medium (40-69)', value: stats.byScore?.medium || 0 },
            { name: 'Low (<40)', value: stats.byScore?.low || 0 },
          ]} />
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-ink-200">Recently discovered domains</h3>
          <Badge variant="neutral">{domains.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-ink-500 text-xs uppercase">
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Authority</th>
                <th className="px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {domains.length > 0 ? domains.slice(0, 8).map(d => (
                <tr key={d.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-ink-300 font-mono text-xs">{d.domain}</td>
                  <td className="px-4 py-3"><Badge variant={d.available === 1 ? 'available' : 'taken'}>{d.available === 1 ? 'Available' : 'Taken'}</Badge></td>
                  <td className="px-4 py-3 text-ink-400">{d.authority_score}</td>
                  <td className="px-4 py-3 text-ink-400">{d.news_industry_score}</td>
                </tr>
              )) : <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-500">No domains yet. Start a crawl job.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
