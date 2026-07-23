import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAcceptanceScore, mergeImprovedOutputs, selectImprovementIndices } from '../../lib/project-quality.mjs';

function output(agentId, confidence, status = 'complete') { return { agentId, confidence, status }; }

test('acceptance score rewards complete high-confidence outputs', () => {
  const outputs = Array.from({ length: 9 }, (_, index) => output(String(index), 92));
  assert.equal(calculateAcceptanceScore(outputs), 94);
  assert.deepEqual(selectImprovementIndices(outputs, 85), []);
});

test('improvement pass selects degraded and lowest-confidence agents first', () => {
  const outputs = [output('a', 80), output('b', 20, 'degraded'), output('c', 55), ...Array.from({ length: 6 }, (_, index) => output(`x${index}`, 70))];
  assert.deepEqual(selectImprovementIndices(outputs, 90, 2), [1, 2]);
});

test('improved outputs only replace degraded or lower-confidence versions', () => {
  const original = [output('a', 50), output('b', 80)];
  const merged = mergeImprovedOutputs(original, [output('a', 88), output('b', 70)]);
  assert.equal(merged[0].confidence, 88);
  assert.equal(merged[1].confidence, 80);
});
