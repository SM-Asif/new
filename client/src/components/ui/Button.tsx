import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', size = 'md', children, disabled, ...props }, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none border';
  const sizes: Record<string, string> = { sm: 'px-2.5 py-1.5', md: 'px-4 py-2.5' };
  const variants: Record<string, string> = {
    primary: 'bg-brand-600 text-white hover:bg-brand-500 shadow-[0_0_20px_rgba(20,184,166,0.25)] border-transparent',
    ghost: 'bg-white/5 text-ink-200 hover:bg-white/10 border-white/10',
    danger: 'bg-red-600/20 text-red-400 hover:bg-red-600/40 border-red-600/30',
  };
  return (<button ref={ref} className={[base, sizes[size], variants[variant], className].filter(Boolean).join(' ')} disabled={disabled} {...props}>{children}</button>);
});
Button.displayName = 'Button';
