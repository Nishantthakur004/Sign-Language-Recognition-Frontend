import { API_CONFIG } from '../config/api';

const listeners = new Set();

// The backend can take 1-2 minutes to wake up (e.g. Render cold start).
const WAKING_TIMEOUT_MS = 120000;
const WAKING_POLL_MS = 3000;
const ONLINE_POLL_MS = 30000;
const OFFLINE_RETRY_MS = 15000;

let snapshot = {
  status: 'waking',
  lastCheckedAt: 0,
  lastError: '',
  retryInMs: WAKING_POLL_MS,
};

let checkPromise = null;
let monitorTimer = 0;
let deadlineTimer = 0;
let monitorStarted = false;
let wakingDeadline = Date.now() + WAKING_TIMEOUT_MS;

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

function isWaking() {
  return snapshot.status === 'waking' && Date.now() < wakingDeadline;
}

function markOffline(message) {
  emit({
    status: 'offline',
    lastCheckedAt: Date.now(),
    lastError: message || 'Backend not connected.',
    retryInMs: OFFLINE_RETRY_MS,
  });
}

export function markRequestSuccess() {
  if (snapshot.status === 'online' && !snapshot.lastError) return;
  emit({ status: 'online', lastCheckedAt: Date.now(), lastError: '', retryInMs: 0 });
}

export function markRequestFailure(error) {
  if (!isUnavailableStatus(error?.status)) return;
  if (isWaking()) {
    emit({ lastCheckedAt: Date.now(), lastError: error?.message || '' });
    return;
  }
  markOffline(error?.message);
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
      const message = timedOut
        ? 'The server took too long to respond. Please try again.'
        : 'Backend not connected. Please try again later.';
      if (isWaking()) {
        emit({ lastCheckedAt: Date.now(), lastError: message });
      } else {
        markOffline(message);
      }
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
  let stopped = false;

  if (snapshot.status === 'waking') {
    const remaining = Math.max(0, wakingDeadline - Date.now());
    window.clearTimeout(deadlineTimer);
    deadlineTimer = window.setTimeout(() => {
      if (snapshot.status === 'waking') markOffline('Backend not connected.');
    }, remaining);
  }

  const schedule = () => {
    if (stopped) return;
    window.clearTimeout(monitorTimer);
    const delay = snapshot.status === 'waking'
      ? WAKING_POLL_MS
      : snapshot.status === 'offline'
        ? OFFLINE_RETRY_MS
        : ONLINE_POLL_MS;
    monitorTimer = window.setTimeout(async () => {
      if (document.visibilityState === 'visible') await checkConnection();
      schedule();
    }, delay);
  };

  checkConnection().then(schedule);

  const handleOnline = () => {
    checkConnection();
  };
  const handleOffline = () => {
    emit({
      status: 'offline',
      lastCheckedAt: Date.now(),
      lastError: 'Your device is offline. Check your network connection.',
      retryInMs: OFFLINE_RETRY_MS,
    });
  };
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') checkConnection();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    stopped = true;
    monitorStarted = false;
    window.clearTimeout(monitorTimer);
    window.clearTimeout(deadlineTimer);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
