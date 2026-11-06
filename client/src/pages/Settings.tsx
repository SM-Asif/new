import * as React from 'react';
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Card';
import { Badge } from '../components/ui/Card';
import { ShieldCheck, Database, RefreshCw, Trash2, Clock } from 'lucide-react';

export const Settings = () => {
  const { settings, setSettings } = useStore();
  const [vals, setVals] = useState(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getSettings().then(s => { setSettings(s); setVals(s); }); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await Promise.all(Object.entries(vals).map(([k, v]) => api.saveSetting(k, v)));
    setSaving(false);
    window.alert('Settings saved');
  };

  const clear = async () => {
    if (!window.confirm('Clear old data (domains, logs, pages older than retention days)?')) return;
    await api.clearData({ olderThanDays: parseInt(vals.retentionDays || '30') || 30, domains: 1, logs: 1, pages: 1 });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-white">Settings</h2>
        <p className="text-ink-400">Configure crawl behavior, data retention, and storage.</p>
      </div>

      <Card>
        <h3 className="text-sm font-medium text-ink-200 mb-4">Storage &amp; retention</h3>
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Retention days" value={vals.retentionDays || '30'} onChange={e => setVals({ ...vals, retentionDays: e.target.value })} />
          <Input label="Max pages per job" value={vals.maxPagesPerJob || '10000'} onChange={e => setVals({ ...vals, maxPagesPerJob: e.target.value })} />
          <Input label="Crawl delay (ms)" value={vals.delayMs || '200'} onChange={e => setVals({ ...vals, delayMs: e.target.value })} />
          <div className="col-span-3 flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</Button>
            <Button variant="danger" onClick={clear}><Trash2 className="w-4 h-4 mr-2" /> Clear old data</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-ink-200 mb-4">How it works</h3>
        <div className="space-y-3 text-sm text-ink-400">
          <div className="flex items-center gap-3"><ShieldCheck className="w-5 h-5" /><span>1. You submit a news website URL.</span></div>
          <div className="flex items-center gap-3"><Database className="w-5 h-5" /><span>2. The crawler reads sitemaps, feeds, and article pages, extracting every outbound link.</span></div>
          <div className="flex items-center gap-3"><RefreshCw className="w-5 h-5" /><span>3. Each discovered domain is checked via WHOIS, DNS, and HTTP to see if it's available to register.</span></div>
          <div className="flex items-center gap-3"><Clock className="w-5 h-5" /><span>4. Domains are scored by age, referring pages, keyword/brand match, and TLD (news, media, press, etc.).</span></div>
          <div className="flex items-center gap-3"><Badge variant="neutral" className="text-[10px]">Continuous</Badge> <span>Jobs re-run automatically while your PC is on.</span></div>
        </div>
      </Card>
    </div>
  );
};
