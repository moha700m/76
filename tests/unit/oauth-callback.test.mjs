import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../../api/oauth/callback.js';

function responseMock() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(value = '') { this.body = value; }
  };
}

test('OAuth callback is no-store and does not server-render query secrets', () => {
  const res = responseMock();
  handler({ method: 'GET', url: '/api/oauth/callback?code=SECRET_CODE&state=SECRET_STATE' }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Cache-Control'], /no-store/);
  assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
  assert.doesNotMatch(res.body, /SECRET_CODE|SECRET_STATE/);
  assert.match(res.body, /Authorization code/);
});

test('OAuth callback rejects non-GET methods', () => {
  const res = responseMock();
  handler({ method: 'POST' }, res);
  assert.equal(res.statusCode, 405);
});
