import { LoaderCircle } from 'lucide-react';

export function buttonStyles({ variant = 'primary', size = 'md', fullWidth = false } = {}) {
  const variants = {
    primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-800 disabled:bg-brand-300',
    secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-brand-300',
    outline: 'border border-slate-200 bg-white text-navy hover:border-brand-200 hover:bg-brand-50 disabled:text-slate-400',
    ghost: 'text-muted hover:bg-slate-100 hover:text-navy disabled:text-slate-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
    dangerGhost: 'bg-red-50 text-red-700 hover:bg-red-100 disabled:text-red-300',
  };
  const sizes = {
    sm: 'min-h-10 px-3.5 py-2 text-sm rounded-xl gap-2',
    md: 'min-h-11 px-5 py-2.5 text-sm rounded-[14px] gap-2',
    lg: 'min-h-12 px-6 py-3 text-base rounded-[14px] gap-2.5',
    icon: 'h-11 w-11 rounded-[14px]',
  };
  return `inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''}`;
}

export default function Button({ children, variant = 'primary', size = 'md', fullWidth = false, loading = false, disabled, type = 'button', className = '', ...props }) {
  return (
    <button
      type={type}
      className={`${buttonStyles({ variant, size, fullWidth })} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
