import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import Button from './Button';

export function LoadingState({ label = 'Loading…', compact = false }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-muted ${compact ? 'py-5' : 'min-h-48 py-12'}`} role="status">
      <LoaderCircle className="h-5 w-5 animate-spin text-brand-700" aria-hidden="true" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', description, action, icon: Icon = Inbox }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-[14px] bg-brand-50 text-brand-700">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="font-heading text-lg font-bold text-navy">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, compact = false }) {
  return (
    <div className={`rounded-card border border-red-100 bg-red-50 px-5 ${compact ? 'py-4' : 'py-8'} text-center`} role="alert">
      <AlertCircle className="mx-auto h-6 w-6 text-red-600" aria-hidden="true" />
      <h3 className="mt-3 font-heading text-base font-bold text-red-950">{title}</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-red-700">{message || 'Please try again.'}</p>
      {onRetry && <Button variant="dangerGhost" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Notice({ children, tone = 'purple' }) {
  const tones = {
    purple: 'border-brand-100 bg-brand-50 text-brand-800',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    red: 'border-red-100 bg-red-50 text-red-800',
  };
  return <div className={`rounded-[14px] border px-4 py-3 text-sm leading-6 ${tones[tone]}`} role={tone === 'red' ? 'alert' : 'status'}>{children}</div>;
}
