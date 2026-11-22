export function normalizePrediction(payload = {}) {
  const nested = payload.prediction && typeof payload.prediction === 'object' ? payload.prediction : payload;
  const sign = typeof nested.prediction === 'string'
    ? nested.prediction
    : nested.sign || nested.label || nested.name || '';
  const rawTop = nested.top3 || nested.top_k || nested.top_k_items || nested.alternatives || [];
  const top3 = (Array.isArray(rawTop) ? rawTop : []).map((item) => {
    if (Array.isArray(item)) return { sign: item[0] || '', confidence: Number(item[1]) || 0 };
    return {
      sign: item.sign || item.label || item.name || '',
      confidence: Number(item.confidence ?? item.score ?? item.probability) || 0,
    };
  }).filter((item) => item.sign).slice(0, 3);

  const confidence = Number(nested.confidence ?? nested.score ?? nested.probability) || 0;
  if (!top3.length && sign) top3.push({ sign, confidence });

  return {
    ...nested,
    sign,
    confidence,
    category: nested.category || null,
    model_version: nested.model_version || nested.modelVersion || null,
    top3,
    hand_detected: nested.hand_detected ?? Boolean(nested.landmarks || nested.hand_landmarks),
    landmarks: nested.landmarks || nested.hand_landmarks || null,
    receivedAt: Date.now(),
  };
}

export function historyPayload(prediction, session) {
  const normalized = normalizePrediction(prediction);
  const payload = {
    prediction_id: normalized.prediction_id,
    sign: normalized.sign,
    confidence: normalized.confidence,
    category: normalized.category,
    model_version: normalized.model_version,
    session_id: session?.id || null,
    duration_ms: Math.max(0, Math.round(session?.durationMs || 0)),
  };
  if (session?.thumbnail) payload.thumbnail = session.thumbnail;
  return payload;
}
