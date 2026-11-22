import {
  API_CONFIG,
  buildApiUrl,
  buildWebSocketUrl,
  resolveMediaUrl,
} from '../config/api';
import { markRequestFailure, markRequestSuccess } from './connection';

export { resolveMediaUrl };

const UNAVAILABLE_MESSAGE = 'Server is currently unavailable. Please try again later.';
const TIMEOUT_MESSAGE = 'The server took too long to respond. Please try again.';

const STATUS_MESSAGES = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  500: 'The server encountered an error. Please try again later.',
  502: UNAVAILABLE_MESSAGE,
  503: UNAVAILABLE_MESSAGE,
  504: TIMEOUT_MESSAGE,
};

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'request_failed', payload = null, cause = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
    this.cause = cause;
  }

  get isNetworkError() {
    return this.code === 'network_error';
  }

  get isTimeout() {
    return this.code === 'timeout';
  }

  get isBackendUnavailable() {
    return this.status === 0 || [502, 503, 504].includes(this.status);
  }
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function errorMessage(payload, status, fallback) {
  if (typeof payload?.detail === 'string') return payload.detail;
  if (Array.isArray(payload?.detail)) {
    const joined = payload.detail.map((item) => item.msg || item.message).filter(Boolean).join(', ');
    if (joined) return joined;
  }
  if (typeof payload?.message === 'string') return payload.message;
  if (typeof payload?.error === 'string') return payload.error;
  return STATUS_MESSAGES[status] || fallback;
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return response.text();
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    timeoutMs = API_CONFIG.timeoutMs,
    responseType = 'json',
    retries = method === 'GET' ? API_CONFIG.retryAttempts : 0,
    signal: externalSignal,
    ...rest
  } = options;

  const requestHeaders = { Accept: 'application/json', ...headers };
  const isFormData = body instanceof FormData;
  if (body && !isFormData) requestHeaders['Content-Type'] = 'application/json';

  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    const forwardAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', forwardAbort);

    let response;
    try {
      response = await fetch(buildApiUrl(path), {
        ...rest,
        method,
        headers: requestHeaders,
        body: isFormData ? body : body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      window.clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', forwardAbort);
      if (externalSignal?.aborted) throw error;

      const timedOut = error?.name === 'AbortError';
      const apiError = new ApiError(timedOut ? TIMEOUT_MESSAGE : UNAVAILABLE_MESSAGE, {
        status: 0,
        code: timedOut ? 'timeout' : 'network_error',
        cause: error,
      });
      markRequestFailure(apiError);

      if (attempt < retries) {
        attempt += 1;
        await delay(API_CONFIG.retryDelayMs * attempt);
        continue;
      }
      throw apiError;
    }

    window.clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', forwardAbort);

    if (response.ok) {
      markRequestSuccess();
      if (responseType === 'blob') return response.blob();
      if (responseType === 'response') return response;
      return parseResponse(response);
    }

    const payload = await parseResponse(response);
    const apiError = new ApiError(
      errorMessage(payload, response.status, `Request failed (${response.status}).`),
      { status: response.status, code: `http_${response.status}`, payload },
    );
    markRequestFailure(apiError);

    if (attempt < retries && [502, 503, 504].includes(response.status)) {
      attempt += 1;
      await delay(API_CONFIG.retryDelayMs * attempt);
      continue;
    }
    throw apiError;
  }
}

export function apiFetch(path, options = {}) {
  return request(path, options);
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
  return buildWebSocketUrl(token);
}

export const recognitionApi = {
  predict: (image, options = {}) => {
    const form = new FormData();
    const { fileField = import.meta.env.VITE_PREDICTION_FILE_FIELD || 'file', ...fields } = options;
    form.append(fileField, image, 'capture.jpg');
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    return request('/recognition/predict', { method: 'POST', body: form });
  },
  predictSequence: (sequence) => request('/recognition/predict-sequence', {
    method: 'POST',
    body: { sequence },
  }),
  recognizeVideo: (file) => {
    const form = new FormData();
    form.append('file', file, file.name || 'sign-video.mp4');
    return request('/recognition/recognize-video', {
      method: 'POST',
      body: form,
      timeoutMs: API_CONFIG.uploadTimeoutMs,
    });
  },
  history: (params) => request(`/recognition/history${queryString(params)}`),
  save: (result) => request('/recognition/history', { method: 'POST', body: result }),
  remove: (id) => request(`/recognition/history/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  clear: () => request('/recognition/history', { method: 'DELETE' }),
  exportCsv: () => request('/recognition/history/export', {
    responseType: 'blob',
    timeoutMs: API_CONFIG.uploadTimeoutMs,
  }),
};

export const dictionaryApi = {
  list: (params) => request(`/dictionary${queryString(params)}`),
  detail: (id) => request(`/dictionary/${encodeURIComponent(id)}`),
  categories: () => request('/dictionary/categories'),
  search: (params) => request(`/dictionary/search${queryString(params)}`),
  favourite: (signId) => request('/dictionary/favourites', {
    method: 'POST',
    body: { sign_id: signId },
  }),
  favourites: () => request('/dictionary/favourites'),
  unfavourite: (signId) => request(`/dictionary/favourites/${encodeURIComponent(signId)}`, {
    method: 'DELETE',
  }),
};

export const analyticsApi = {
  overview: () => request('/analytics/overview'),
  trends: (period) => request(`/analytics/trends${queryString({ period })}`),
  popularSigns: (params) => request(`/analytics/popular-signs${queryString(params)}`),
};

export const datasetApi = {
  status: () => request('/dataset/status'),
  prepare: () => request('/dataset/prepare', { method: 'POST' }),
  prepareStatus: () => request('/dataset/prepare/status'),
  train: (payload) => request('/model/train', { method: 'POST', body: payload }),
  stopTraining: () => request('/model/stop', { method: 'POST' }),
  trainingStatus: () => request('/model/status'),
  metrics: () => request('/model/metrics'),
  reload: () => request('/model/reload', { method: 'POST' }),
};

export const publicApi = {
  health: () => request(API_CONFIG.healthUrl),
};
