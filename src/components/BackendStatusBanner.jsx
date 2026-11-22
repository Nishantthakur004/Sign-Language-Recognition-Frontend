import { RefreshCw, ServerCrash } from 'lucide-react';
import useConnectionStatus from '../hooks/useConnectionStatus';
import { checkConnection } from '../services/connection';

export default function BackendStatusBanner() {
  const connection = useConnectionStatus();
  if (connection.status !== 'offline') return null;

  return (
    <div className="border-b border-red-100 bg-red-50" role="alert">
      <div className="container-app flex flex-col gap-2 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <ServerCrash className="h-4 w-4 shrink-0" aria-hidden="true" />
          Server is currently unavailable. Please try again later.
        </p>
        <button
          type="button"
          onClick={() => checkConnection()}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-100 sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry connection
        </button>
      </div>
    </div>
  );
}
