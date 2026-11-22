export function asArray(payload, keys = ['items', 'results', 'data', 'history', 'signs', 'users']) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

export function collectionTotal(payload, fallback = 0) {
  const value = payload?.total ?? payload?.count ?? payload?.pagination?.total;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

export function confidencePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric <= 1 ? numeric * 100 : numeric));
}

export function formatConfidence(value) {
  return `${Math.round(confidencePercent(value))}%`;
}

export function formatNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en').format(numeric) : '—';
}

export function formatDate(value, includeTime = true) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(date);
}

export function displayName(user) {
  return user?.full_name || user?.name || user?.username || user?.email?.split('@')[0] || 'Account';
}

export function itemId(item) {
  return item?.id ?? item?.sign_id ?? item?._id;
}

export function itemLabel(item) {
  return item?.label || item?.name || item?.sign || item?.title || 'Unnamed sign';
}

export function historyDate(item) {
  return item?.created_at || item?.timestamp || item?.date || item?.recognized_at;
}

export function formatDuration(value, unit = 'seconds') {
  let seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (unit === 'milliseconds') seconds /= 1000;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.round(seconds % 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${remaining}s`;
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function errorText(error) {
  return error?.message || 'The request could not be completed.';
}
