const configuredApiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const DEPLOYED_API_URL = 'https://sign-language-recognition-k83h.onrender.com';

export const API_URL = configuredApiUrl || (isLocalHost ? '' : DEPLOYED_API_URL);

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function errorMessage(payload, fallback) {
  if (typeof payload?.detail === 'string') return payload.detail;
  if (Array.isArray(payload?.detail)) {
    return payload.detail.map((item) => item.msg || item.message).filter(Boolean).join(', ') || fallback;
  }
  return payload?.message || payload?.error || fallback;
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

export async function apiFetch(path, options = {}) {
  const { body, headers = {}, ...rest } = options;
  const requestHeaders = { Accept: 'application/json', ...headers };
  if (body && !(body instanceof FormData)) requestHeaders['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: requestHeaders,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0, error);
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new ApiError(errorMessage(payload, `Request failed (${response.status}).`), response.status, payload);
  }
  return payload;
}

export function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, value);
  });
  const result = query.toString();
  return result ? `?${result}` : '';
}

export function getWebSocketUrl(token) {
  const configured = import.meta.env.VITE_WS_URL;
  const target = configured || `${API_URL}/ws/recognition`;
  const url = new URL(target, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

export function resolveMediaUrl(url) {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

export const recognitionApi = {
  predict: (image, options = {}) => {
    const form = new FormData();
    const { fileField = import.meta.env.VITE_PREDICTION_FILE_FIELD || 'file', ...fields } = options;
    form.append(fileField, image, 'capture.jpg');
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    });
    return apiFetch('/api/recognition/predict', { method: 'POST', body: form });
  },
  predictSequence: (sequence) => apiFetch('/api/recognition/predict-sequence', { method: 'POST', body: { sequence } }),
  recognizeVideo: (file) => {
    const form = new FormData();
    form.append('file', file, file.name || 'sign-video.mp4');
    return apiFetch('/api/recognition/recognize-video', { method: 'POST', body: form });
  },
  history: (params) => apiFetch(`/api/recognition/history${queryString(params)}`),
  save: (result) => apiFetch('/api/recognition/history', { method: 'POST', body: result }),
  remove: (id) => apiFetch(`/api/recognition/history/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  clear: () => apiFetch('/api/recognition/history', { method: 'DELETE' }),
  exportCsv: async () => {
    let response;
    try {
      response = await fetch(`${API_URL}/api/recognition/history/export`);
    } catch (error) {
      throw new ApiError('Unable to reach the server. Check your connection and try again.', 0, error);
    }
    if (!response.ok) {
      throw new ApiError('The history export could not be downloaded.', response.status);
    }
    return response.blob();
  },
};

export const dictionaryApi = {
  list: (params) => apiFetch(`/api/dictionary${queryString(params)}`),
  detail: (id) => apiFetch(`/api/dictionary/${encodeURIComponent(id)}`),
  categories: () => apiFetch('/api/dictionary/categories'),
  search: (params) => apiFetch(`/api/dictionary/search${queryString(params)}`),
  favourite: (signId) => apiFetch('/api/dictionary/favourites', { method: 'POST', body: { sign_id: signId } }),
  favourites: () => apiFetch('/api/dictionary/favourites'),
  unfavourite: (signId) => apiFetch(`/api/dictionary/favourites/${encodeURIComponent(signId)}`, { method: 'DELETE' }),
};

export const analyticsApi = {
  overview: () => apiFetch('/api/analytics/overview'),
  trends: (period) => apiFetch(`/api/analytics/trends${queryString({ period })}`),
  popularSigns: (params) => apiFetch(`/api/analytics/popular-signs${queryString(params)}`),
};

export const datasetApi = {
  status: () => apiFetch('/api/dataset/status'),
  prepare: () => apiFetch('/api/dataset/prepare', { method: 'POST' }),
  prepareStatus: () => apiFetch('/api/dataset/prepare/status'),
  train: (payload) => apiFetch('/api/model/train', { method: 'POST', body: payload }),
  stopTraining: () => apiFetch('/api/model/stop', { method: 'POST' }),
  trainingStatus: () => apiFetch('/api/model/status'),
  metrics: () => apiFetch('/api/model/metrics'),
  reload: () => apiFetch('/api/model/reload', { method: 'POST' }),
};

export const publicApi = {
  health: () => apiFetch('/health'),
};
