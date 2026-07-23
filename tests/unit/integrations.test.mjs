import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkGitHubConnection,
  checkOpenAIConnection,
  createOpenAIBrief,
  getGitHubToken
} from '../../api/_lib/integrations.js';

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    async json() { return data; },
    async text() { return JSON.stringify(data); }
  };
}

test('GH_PAT is preferred without exposing the secret', async () => {
  const secret = 'github_pat_secret_value';
  assert.equal(getGitHubToken({ GH_PAT: secret, GITHUB_DISPATCH_TOKEN: 'legacy' }), secret);
  const result = await checkGitHubConnection({
    env: { GH_PAT: secret, GITHUB_REPOSITORY: 'moha700m/76' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.github.com/repos/moha700m/76');
      assert.equal(options.headers.authorization, `Bearer ${secret}`);
      return response(200, {
        full_name: 'moha700m/76',
        default_branch: 'main',
        permissions: { pull: true, push: true }
      });
    }
  });
  assert.deepEqual(result, {
    configured: true,
    connected: true,
    repository: 'moha700m/76',
    defaultBranch: 'main',
    canRead: true,
    canWrite: true
  });
  assert.doesNotMatch(JSON.stringify(result), /github_pat_secret_value/);
});

test('OpenAI connection checks configured model without exposing the key', async () => {
  const secret = 'sk-proj-secret-value';
  const result = await checkOpenAIConnection({
    env: { OPENAI_API_KEY: secret, OPENAI_MODEL: 'gpt-5-nano' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/models');
      assert.equal(options.headers.authorization, `Bearer ${secret}`);
      return response(200, { data: [{ id: 'gpt-5-nano' }] });
    }
  });
  assert.deepEqual(result, {
    configured: true,
    connected: true,
    model: 'gpt-5-nano',
    modelAvailable: true
  });
  assert.doesNotMatch(JSON.stringify(result), /sk-proj-secret-value/);
});

test('OpenAI brief route uses Responses API server-side', async () => {
  const result = await createOpenAIBrief('أحتاج موقعًا لمحل عسل يركز على طلبات الواتساب والعملاء في السعودية.', {
    env: { OPENAI_API_KEY: 'hidden-key', OPENAI_MODEL: 'gpt-5-nano' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.authorization, 'Bearer hidden-key');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'gpt-5-nano');
      assert.equal(body.store, false);
      assert.ok(body.max_output_tokens <= 350);
      return response(200, { output_text: 'الهدف: بناء موقع لمحل عسل يسهّل طلبات العملاء عبر واتساب.' });
    }
  });
  assert.equal(result.model, 'gpt-5-nano');
  assert.match(result.text, /الهدف/);
});
