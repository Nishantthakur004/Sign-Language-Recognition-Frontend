import { API_CONFIG } from '../config/api';

const listeners = new Set();

let snapshot = {
  status: 'checking',
  lastCheckedAt: 0,
  lastError: '',
  retryInMs: 0,
};

let checkPromise = null;
let monitorTimer = 0;
let retryDelay = 5000;
let monitorStarted = false;

function emit(next) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function getConnectionSnapshot() {
  return snapshot;
}

export function subscribeToConnection(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isUnavailableStatus(status) {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

export function markRequestSuccess() {
  retryDelay = 5000;
  if (snapshot.status === 'online' && !snapshot.lastError) return;
  emit({ status: 'online', lastCheckedAt: Date.now(), lastError: '', retryInMs: 0 });
}

export function markRequestFailure(error) {
  if (!isUnavailableStatus(error?.status)) return;
  emit({
    status: 'offline',
    lastCheckedAt: Date.now(),
    lastError: error?.message || 'Server is currently unavailable. Please try again later.',
    retryInMs: retryDelay,
  });
}

export function checkConnection() {
  if (checkPromise) return checkPromise;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), API_CONFIG.healthTimeoutMs);

  checkPromise = (async () => {
    try {
      const response = await fetch(API_CONFIG.healthUrl, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`Health check failed (${response.status}).`);
        error.status = response.status;
        throw error;
      }
      markRequestSuccess();
      return true;
    } catch (error) {
      const timedOut = error?.name === 'AbortError';
      markRequestFailure({
        status: error?.status ?? 0,
        message: timedOut
          ? 'The server took too long to respond. Please try again.'
          : 'Server is currently unavailable. Please try again later.',
      });
      return false;
    } finally {
      window.clearTimeout(timer);
      checkPromise = null;
    }
  })();

  return checkPromise;
}

export function startConnectionMonitor() {
  if (monitorStarted) return () => {};
  monitorStarted = true;
  checkConnection();

  const schedule = () => {
    window.clearTimeout(monitorTimer);
    const delay = snapshot.status === 'offline' ? retryDelay : 30000;
    monitorTimer = window.setTimeout(async () => {
      if (document.visibilityState === 'visible') await checkConnection();
      if (snapshot.status === 'offline') retryDelay = Math.min(retryDelay * 2, 30000);
      schedule();
    }, delay);
  };
  schedule();

  const handleOnline = () => {
    retryDelay = 5000;
    checkConnection();
  };
  const handleOffline = () => {
    emit({
      status: 'offline',
      lastCheckedAt: Date.now(),
      lastError: 'Your device is offline. Check your network connection.',
      retryInMs: retryDelay,
    });
  };
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') checkConnection();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    monitorStarted = false;
    window.clearTimeout(monitorTimer);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
