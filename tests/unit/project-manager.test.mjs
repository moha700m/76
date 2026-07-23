import assert from 'node:assert/strict';
import test from 'node:test';
import { createFallbackBrief, createTaskPlan, extractIdeaUrls, fallbackProjectName, normalizeIdea } from '../../lib/project-manager.mjs';

test('manager accepts a short idea and produces safe fallback fields', () => {
  const idea = normalizeIdea('  أبي منصة للحضانات تساعد الأهالي يحجزون زيارة  ');
  const result = createFallbackBrief(idea);
  assert.equal(result.brief, 'أبي منصة للحضانات تساعد الأهالي يحجزون زيارة');
  assert.ok(result.name.length > 0);
  assert.equal(result.references.length, 0);
  assert.equal(result.mode, 'balanced');
});

test('manager only preserves reference URLs explicitly supplied by the user', () => {
  const urls = extractIdeaUrls('أبي شيء قريب من https://example.com ومن https://sample.sa/path.');
  assert.deepEqual(urls, ['https://example.com', 'https://sample.sa/path']);
});

test('task plan assigns one concrete task to every agent', () => {
  const agents = [
    { id: 'one', name: 'الأول', mission: 'حلل الموجز.' },
    { id: 'two', name: 'الثاني', mission: 'راجع الجودة.' }
  ];
  const tasks = createTaskPlan(agents, { goal: 'زيادة الحجوزات' });
  assert.equal(tasks.length, 2);
  assert.match(tasks[0].task, /زيادة الحجوزات/);
  assert.equal(fallbackProjectName('منصة بسيطة للحجوزات'), 'منصة بسيطة للحجوزات');
});
