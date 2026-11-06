import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Globe, Newspaper, Target, Settings as SettingsIcon } from 'lucide-react';

const NAV = [
  { path: '/', icon: Newspaper, label: 'Dashboard' },
  { path: '/domains', icon: Globe, label: 'Domains' },
  { path: '/jobs', icon: Target, label: 'Crawl Jobs' },
  { path: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export const Navbar = () => {
  const location = useLocation();
  const { connected } = useStore();
  return (
    <nav className="glass border-b border-white/5 sticky top-0 z-20">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.4)]">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-white tracking-tight">News Domain Hunter</h1>
            <p className="text-xs text-ink-400">Expired & available news domain finder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-brand-500 animate-pulse' : 'bg-ink-500'}`} />
            <span>{connected ? 'Live' : 'Disconnected'}</span>
          </div>
          <div className="ml-4 flex items-center gap-2">
            {NAV.map(n => {
              const active = location.pathname === n.path || (n.path !== '/' && location.pathname.startsWith(n.path));
              const Icon = n.icon;
              return (
                <Link key={n.path} to={n.path} className={[
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border',
                  active ? 'bg-brand-600/20 text-brand-300 border-brand-600/40 shadow-[0_0_10px_rgba(20,184,166,0.2)]' : 'text-ink-400 hover:text-white hover:bg-white/5',
                ].join(' ')}>
                  <Icon className="w-4 h-4" /> {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen grid-border">
    <Navbar />
    <main className="pt-6 px-6 pb-12 max-w-7xl mx-auto">{children}</main>
  </div>
);
