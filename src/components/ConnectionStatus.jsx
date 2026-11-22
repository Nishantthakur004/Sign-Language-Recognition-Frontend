import { RefreshCw } from 'lucide-react';
import useConnectionStatus from '../hooks/useConnectionStatus';
import { checkConnection } from '../services/connection';

const STATES = {
  online: {
    label: 'Backend connected',
    dot: 'bg-emerald-500',
    tone: 'bg-emerald-50 text-emerald-700',
  },
  waking: {
    label: 'Waking up the server, Please Wait',
    dot: 'bg-amber-400',
    tone: 'bg-amber-50 text-amber-800',
  },
  offline: {
    label: 'Backend not connected',
    dot: 'bg-red-500',
    tone: 'bg-red-50 text-red-700',
  },
};

export default function ConnectionStatus({ compact = false }) {
  const connection = useConnectionStatus();
  const state = STATES[connection.status] || STATES.waking;
  const waking = connection.status === 'waking';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${state.tone}`}
      title={connection.lastError || state.label}
      role="status"
      aria-live="polite"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${state.dot} ${waking ? 'animate-pulse' : ''}`}
        aria-hidden="true"
      />
      <span className={compact ? 'hidden sm:inline' : ''}>
        {state.label}
        {waking && (
          <span className="status-dots" aria-hidden="true">
            <span className="status-dot">.</span>
            <span className="status-dot" style={{ animationDelay: '160ms' }}>.</span>
            <span className="status-dot" style={{ animationDelay: '320ms' }}>.</span>
          </span>
        )}
      </span>
      {connection.status === 'offline' && (
        <button
          type="button"
          onClick={() => checkConnection()}
          className="ml-0.5 rounded-full p-1 transition hover:bg-red-100"
          aria-label="Retry backend connection"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
