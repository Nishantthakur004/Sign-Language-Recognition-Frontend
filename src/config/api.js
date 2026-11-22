/**
 * Single source of truth for every backend URL used by the frontend.
 * The backend origin is configured with VITE_API_BASE_URL and must include
 * the /api suffix, e.g. http://localhost:8000/api.
 */
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const isDev = Boolean(import.meta.env.DEV);

const DEFAULT_DEV_API_BASE_URL = 'http://localhost:8000/api';

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

export const API_BASE_URL = normalizeBaseUrl(
  rawBaseUrl || (isDev ? DEFAULT_DEV_API_BASE_URL : '/api'),
);

// Origin without the /api suffix, used for WebSocket and media URLs.
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  origin: API_ORIGIN,
  // The health endpoint lives at the backend origin, outside the /api prefix.
  healthUrl: `${API_ORIGIN}/health`,
  wsUrl: `${API_ORIGIN.replace(/^http/, 'ws')}/ws/recognition`,
  timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 20000,
  uploadTimeoutMs: Number(import.meta.env.VITE_API_UPLOAD_TIMEOUT_MS) || 180000,
  healthTimeoutMs: 20000,
  retryAttempts: 2,
  retryDelayMs: 600,
  isConfigured: Boolean(rawBaseUrl),
};

if (!rawBaseUrl && !isDev) {
  console.error(
    '[SignTrans] VITE_API_BASE_URL is not set. Set it to your production backend URL, e.g. https://your-backend-domain.com/api',
  );
}

export function buildApiUrl(path = '') {
  if (!path) return API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildWebSocketUrl(token) {
  const url = new URL(API_CONFIG.wsUrl, window.location.href);
  // Only upgrade http(s) URLs; a wss:// URL must stay secure or the browser
  // blocks it as mixed content on an HTTPS page.
  if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol === 'http:') url.protocol = 'ws:';
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

export function resolveMediaUrl(url) {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
}
