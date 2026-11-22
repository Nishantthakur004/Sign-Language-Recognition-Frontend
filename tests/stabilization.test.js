import test from 'node:test';
import assert from 'node:assert/strict';
import { GestureStabilizer } from '../src/services/stabilization.js';

test('low confidence predictions are uncertain and reset the window', () => {
  const stabilizer = new GestureStabilizer({ minConfidence: 0.6 });
  const result = stabilizer.push({ sign: 'A', confidence: 0.4 });
  assert.equal(result.status, 'uncertain');
  assert.equal(stabilizer.history.length, 0);
});

test('a sign becomes stable only after enough agreeing frames', () => {
  const stabilizer = new GestureStabilizer({ windowSize: 8, minVotes: 5, minConfidence: 0.6, cooldownMs: 1000 });
  let result;
  for (let index = 0; index < 4; index += 1) {
    result = stabilizer.push({ sign: 'A', confidence: 0.9 }, index * 100);
  }
  assert.equal(result.status, 'stabilizing');
  result = stabilizer.push({ sign: 'A', confidence: 0.9 }, 400);
  assert.equal(result.status, 'stable');
  assert.equal(result.sign, 'A');
  assert.equal(result.isNew, true);
});

test('cooldown suppresses duplicate stable emissions of the same sign', () => {
  const stabilizer = new GestureStabilizer({ windowSize: 8, minVotes: 3, minConfidence: 0.6, cooldownMs: 1000 });
  for (let index = 0; index < 3; index += 1) stabilizer.push({ sign: 'B', confidence: 0.8 }, index * 100);
  const duplicate = stabilizer.push({ sign: 'B', confidence: 0.8 }, 500);
  assert.equal(duplicate.status, 'stable');
  assert.equal(duplicate.isNew, false);
  const later = stabilizer.push({ sign: 'B', confidence: 0.8 }, 2000);
  assert.equal(later.isNew, true);
});

test('a different stable sign is emitted immediately', () => {
  const stabilizer = new GestureStabilizer({ windowSize: 8, minVotes: 3, minConfidence: 0.6, cooldownMs: 5000 });
  for (let index = 0; index < 3; index += 1) stabilizer.push({ sign: 'A', confidence: 0.9 }, index * 100);
  let result;
  for (let index = 0; index < 3; index += 1) result = stabilizer.push({ sign: 'B', confidence: 0.9 }, 400 + index * 100);
  assert.equal(result.status, 'stable');
  assert.equal(result.sign, 'B');
  assert.equal(result.isNew, true);
});
