import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Job = {
  id: string; name: string; seed_url: string; status: string;
  max_pages: number; max_depth: number; concurrency: number; delay_ms: number;
  pages_crawled: number; domains_found: number; domains_available?: number;
  created_at: number; updated_at: number;
};

export type Domain = {
  id: string; job_id: string; domain: string; url: string; page_url: string;
  link_text?: string; link_context?: string; first_seen: number; last_seen: number;
  seen_count: number; available: number; available_checked: number;
  whois_created?: number; whois_expires?: number; whois_registrar?: string;
  dns_a: string[]; dns_mx: string[]; dns_ns: string[]; age_days?: number;
  authority_score: number; keyword_match: number; brand_match: number;
  news_industry_score: number; country?: string; notes?: string; status: string;
};

type State = {
  jobs: Job[]; domains: Domain[]; stats: any; logs: any[];
  settings: Record<string, string>;
  connected: boolean; activeJob: string | null;
  setJobs: (j: Job[]) => void; setDomains: (d: Domain[]) => void;
  setStats: (s: any) => void; setLogs: (l: any[]) => void;
  setSettings: (s: Record<string, string>) => void;
  setConnected: (c: boolean) => void; setActiveJob: (id: string | null) => void;
  addLog: (l: any) => void; addDomain: (d: Domain) => void;
  updateJobStatus: (id: string, status: string) => void;
};

export const useStore = create<State>()(persist((set) => ({
  jobs: [], domains: [], stats: {}, logs: [], settings: {},
  connected: false, activeJob: null,
  setJobs: (j) => set({ jobs: j }),
  setDomains: (d) => set({ domains: d }),
  setStats: (s) => set({ stats: s }),
  setLogs: (l) => set({ logs: l }),
  setSettings: (s) => set({ settings: s }),
  setConnected: (c) => set({ connected: c }),
  setActiveJob: (id) => set({ activeJob: id }),
  addLog: (l) => set((s) => ({ logs: [l, ...s.logs].slice(0, 500) })),
  addDomain: (d) => set((s) => ({ domains: [d, ...s.domains] })),
  updateJobStatus: (id, status) => set((s) => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, status } : j) })),
}), { name: 'hunter-store', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ settings: s.settings }) }));
