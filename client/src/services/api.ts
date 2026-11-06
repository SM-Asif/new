const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:4000';

import { io } from 'socket.io-client';

export const api = {
  getJobs: () => fetch(`${API_BASE}/api/jobs`).then(r => r.json()),
  createJob: (body: any) => fetch(`${API_BASE}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  startJob: (id: string) => fetch(`${API_BASE}/api/jobs/${id}/start`, { method: 'POST' }).then(r => r.json()),
  stopJob: (id: string) => fetch(`${API_BASE}/api/jobs/${id}/stop`, { method: 'POST' }).then(r => r.json()),
  deleteJob: (id: string) => fetch(`${API_BASE}/api/jobs/${id}`, { method: 'DELETE' }).then(r => r.json()),
  getDomains: (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return fetch(`${API_BASE}/api/domains${qs}`).then(r => r.json());
  },
  getStats: (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return fetch(`${API_BASE}/api/domains/stats${qs}`).then(r => r.json());
  },
  recheckDomains: (ids: string[]) => fetch(`${API_BASE}/api/domains/recheck`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }).then(r => r.json()),
  getLogs: (params?: any) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return fetch(`${API_BASE}/api/logs${qs}`).then(r => r.json());
  },
  getSettings: () => fetch(`${API_BASE}/api/settings`).then(r => r.json()),
  saveSetting: (key: string, value: string) => fetch(`${API_BASE}/api/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) }).then(r => r.json()),
  clearData: (body: any) => fetch(`${API_BASE}/api/settings/clear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
  oneOffCrawl: (body: any) => fetch(`${API_BASE}/api/crawl`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()),
};

export function connectSocket(jobId: string | null, onEvent: (e: any) => void) {
  const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    if (jobId) socket.emit('join:job', jobId);
  });
  socket.on('event', (e: any) => {
    if (!jobId || e.jobId === jobId) onEvent(e);
  });
  return socket;
}
