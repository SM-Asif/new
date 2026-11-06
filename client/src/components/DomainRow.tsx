import * as React from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Card';

export interface DomainRowProps { domain: any; onRecheck?: (id: string) => void; }

export const DomainRow = ({ domain, onRecheck }: DomainRowProps) => {
  const available = domain.available === 1;
  const age = domain.age_days ? Math.floor(domain.age_days / 365) + 'y old' : 'unknown age';
  const seen = domain.seen_count ? `${domain.seen_count} refs` : 'new';
  return (
    <tr className="group border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-xs font-mono text-ink-300 group-hover:text-brand-400 transition-colors">
            {domain.domain.split('.')[0][0]?.toUpperCase() || '?'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-white truncate">{domain.domain}</span>
            <span className="text-xs text-ink-500 truncate max-w-xs">{domain.page_url || domain.url}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><Badge variant={available ? 'available' : 'taken'}>{available ? 'Available' : 'Taken'}</Badge></td>
      <td className="px-4 py-3 text-sm text-ink-300">{age}</td>
      <td className="px-4 py-3 text-sm text-ink-300">{seen}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-brand-500" style={{ width: Math.max(domain.authority_score, 5) + '%' }} />
          </div>
          <span className="ml-2 text-xs font-mono text-ink-400">{domain.authority_score}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        {available && (
          <Button variant="ghost" onClick={() => onRecheck?.(domain.id)} className="text-xs px-2 py-1.5">
            Recheck
          </Button>
        )}
        <a href={`https://whois.domaintools.com/${domain.domain}`} target="_blank" rel="noopener" className="text-xs text-ink-500 hover:text-brand-400">
          Whois
        </a>
      </td>
    </tr>
  );
};
