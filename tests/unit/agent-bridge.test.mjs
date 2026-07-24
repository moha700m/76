import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentBridgeError,
  CWC_AGENTS,
  callOpenAIWave,
  extractResponseText,
  responseSchemaForWave,
  validateWaveRequest
} from '../../api/_lib/nasq-agent-bridge.js';

function project() {
  return {
    name: 'محمصة السرو',
    brief: 'متجر قهوة مختصة سعودي يقدم محاصيل مختارة وتجربة شراء عربية واضحة.',
    audience: 'محبو القهوة المختصة',
    goal: 'استكشاف المحاصيل وبدء الطلب',
    style: 'ورقي دافئ بألوان عاجية وبنية وزيتونية',
    references: [], evidence: [], memories: []
  };
}

function outputFor(agent) {
  return {
    agentId: agent.id,
    summary: `ملخص ${agent.name} خاص بالمشروع`,
    findings: ['نتيجة مرتبطة بالمشروع', 'فرصة قابلة للتنفيذ', 'قيد يحتاج مراجعة'],
    decisions: ['قرار واضح', 'معيار قبول'],
    deliverable: `تسليم ${agent.name}`,
    confidence: 86
  };
}

function mockResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) { return headers[name.toLowerCase()] || null; } },
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
    async json() { return body; }
  };
}

test('validates wave progression and required previous outputs', () => {
  const first = validateWaveRequest({ wave: 1, project: project(), previousOutputs: [] });
  assert.equal(first.wave, 1);
  assert.equal(first.previousOutputs.length, 0);
  assert.throws(
    () => validateWaveRequest({ wave: 2, project: project(), previousOutputs: [] }),
    error => error instanceof AgentBridgeError && error.code === 'invalid_previous_outputs'
  );
});

test('wave three schema requires synthesis and public content', () => {
  const schema = responseSchemaForWave(3);
  assert.ok(schema.required.includes('synthesis'));
  assert.ok(schema.properties.synthesis.properties.publicContent);
});

test('extracts output text from Responses API payload', () => {
  const value = extractResponseText({ output: [{ content: [{ type: 'output_text', text: '{"ok":true}' }] }] });
  assert.equal(value, '{"ok":true}');
});

test('retries a transient 429 and returns three authentic role outputs', async () => {
  const roles = CWC_AGENTS.slice(0, 3);
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return mockResponse(429, { error: 'rate limit' }, { 'retry-after': '0' });
    return mockResponse(200, {
      output: [{ content: [{ type: 'output_text', text: JSON.stringify({ outputs: roles.map(outputFor) }) }] }],
      usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 }
    });
  };
  const payload = validateWaveRequest({ wave: 1, project: project(), previousOutputs: [], requestId: 'test-wave-1' });
  const result = await callOpenAIWave(payload, { apiKey: 'test-key', fetchImpl, sleepImpl: async () => {} });
  assert.equal(calls, 2);
  assert.equal(result.outputs.length, 3);
  assert.deepEqual(result.outputs.map(item => item.agentId), roles.map(item => item.id));
  assert.ok(result.outputs.every(item => item.status === 'complete'));
});

test('rejects mismatched agent identities instead of inventing recovery outputs', async () => {
  const payload = validateWaveRequest({ wave: 1, project: project(), previousOutputs: [], requestId: 'test-invalid' });
  const fetchImpl = async () => mockResponse(200, {
    output: [{ content: [{ type: 'output_text', text: JSON.stringify({ outputs: [
      outputFor({ id: 'wrong-1', name: 'خاطئ' }),
      outputFor({ id: 'wrong-2', name: 'خاطئ' }),
      outputFor({ id: 'wrong-3', name: 'خاطئ' })
    ] }) }] }]
  });
  await assert.rejects(
    () => callOpenAIWave(payload, { apiKey: 'test-key', fetchImpl, sleepImpl: async () => {} }),
    error => error instanceof AgentBridgeError && error.code === 'invalid_provider_output'
  );
});
