import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePrediction, historyPayload } from '../src/services/prediction.js';

test('normalizes a backend prediction with top_k alternatives', () => {
  const result = normalizePrediction({
    sign: 'A',
    confidence: 0.91,
    category: 'alphabet',
    top_k: [
      { sign: 'A', confidence: 0.91 },
      { sign: 'B', confidence: 0.05 },
    ],
    prediction_id: 'prediction-1',
  });
  assert.equal(result.sign, 'A');
  assert.equal(result.confidence, 0.91);
  assert.equal(result.top3.length, 2);
  assert.equal(result.top3[1].sign, 'B');
});

test('unwraps a websocket prediction envelope', () => {
  const result = normalizePrediction({ prediction: { sign: '7', confidence: 0.7 } });
  assert.equal(result.sign, '7');
  assert.equal(result.top3[0].sign, '7');
});

test('history payload uses the server prediction id and session metadata', () => {
  const payload = historyPayload(
    { sign: 'A', confidence: 0.9, prediction_id: 'prediction-2' },
    { id: 'session-1', durationMs: 2500, thumbnail: 'data:image/jpeg;base64,abc' },
  );
  assert.equal(payload.prediction_id, 'prediction-2');
  assert.equal(payload.session_id, 'session-1');
  assert.equal(payload.duration_ms, 2500);
  assert.equal(payload.thumbnail, 'data:image/jpeg;base64,abc');
});
