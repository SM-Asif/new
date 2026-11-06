import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, children, hover = false, ...props }, ref) => (
  <div ref={ref} className={[
    'glass rounded-2xl p-6 border border-white/5 transition-colors',
    hover ? 'hover:border-white/10' : '',
    className,
  ].filter(Boolean).join(' ')} {...props}>{children}</div>
));
Card.displayName = 'Card';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'available' | 'taken' | 'neutral';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = 'neutral', children, ...props }, ref) => {
  const variants: Record<string, string> = {
    available: 'bg-brand-600/20 text-brand-400 border border-brand-600/40',
    taken: 'bg-red-600/20 text-red-400 border border-red-600/40',
    neutral: 'bg-white/10 text-ink-400 border border-white/10',
  };
  return (<span ref={ref} className={['inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium border', variants[variant], className].filter(Boolean).join(' ')} {...props}>{children}</span>);
});
Badge.displayName = 'Badge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, label, ...props }, ref) => (
  <div className="mb-4">
    {label && <label className="block text-xs font-medium text-ink-400 mb-1.5 uppercase tracking-wider">{label}</label>}
    <input ref={ref} className={['w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all', className].filter(Boolean).join(' ')} {...props} />
  </div>
));
Input.displayName = 'Input';

export interface StatCardProps { title: string; value: string | number; sub?: string; trend?: string; }

export const StatCard = ({ title, value, sub, trend }: StatCardProps) => (
  <Card className="p-5">
    <div className="flex items-end justify-between gap-2 mb-2">
      <div>
        <p className="text-xs text-ink-400 uppercase tracking-wider mb-0.5">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
      </div>
      {trend && <span className={`text-xs font-medium ${trend.startsWith('+') ? 'text-brand-400' : 'text-red-400'}`}>{trend}</span>}
    </div>
  </Card>
);
