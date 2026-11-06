import * as React from 'react';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import { connectSocket } from './services/api';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Domains } from './pages/Domains';
import { Jobs } from './pages/Jobs';
import { Settings } from './pages/Settings';
import { Logs } from './pages/Logs';

async function fetchJobs(setJobs: (j: any[]) => void) {
  try {
    const res = await fetch('http://localhost:4000/api/jobs');
    const data = await res.json();
    setJobs(data || []);
  } catch { /* server may not be running yet */ }
}

export default function App() {
  const { setConnected, setJobs, setDomains, setStats, setLogs, addLog, addDomain, updateJobStatus } = useStore();

  useEffect(() => {
    const socket = connectSocket(null, (e) => {
      switch (e.type) {
        case 'status':
          if (e.jobId) updateJobStatus(e.jobId, e.status);
          break;
        case 'log':
          addLog(e);
          break;
        case 'domain':
          addDomain(e);
          break;
        case 'domain_rechecked':
          addDomain(e);
          break;
        default:
          break;
      }
      if (e.type === 'status') setConnected(true);
    });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    return () => {
      socket.disconnect();
    };
  }, [setConnected, addLog, addDomain, updateJobStatus]);

  useEffect(() => {
    fetchJobs(setJobs);
  }, [setJobs]);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/domains" element={<Domains />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
