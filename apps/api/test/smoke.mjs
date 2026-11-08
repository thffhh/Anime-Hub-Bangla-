import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { isBangladeshMobileNumber } from '../dist/payment-settings.js';
import { isPublicHttpsUrl } from '../dist/public-url.js';

assert.equal(isPublicHttpsUrl('https://example.com/app.apk'), true);
assert.equal(isPublicHttpsUrl('http://example.com/app.apk'), false);
assert.equal(isPublicHttpsUrl('javascript:alert(1)'), false);
assert.equal(isPublicHttpsUrl('https://user:pass@example.com/app.apk'), false);
assert.equal(isPublicHttpsUrl(''), false);

assert.equal(isBangladeshMobileNumber('01712345678'), true);
assert.equal(isBangladeshMobileNumber('+8801712345678'), true);
assert.equal(isBangladeshMobileNumber('01712 345678'), false);
assert.equal(isBangladeshMobileNumber('01212345678'), false);
assert.equal(isBangladeshMobileNumber(''), false);

// Bind an ephemeral port, then use it for the isolated API process.
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const env = { ...process.env, PORT: String(port), DATABASE_URL: '', JWT_SECRET: 'test-only-secret-not-for-production-12345' };
const child = spawn(process.execPath, ['dist/index.js'], { env, cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
try {
  const base = `http://127.0.0.1:${port}`;
  let response;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { response = await fetch(`${base}/api/health`); break; } catch { await delay(100); }
    if (child.exitCode !== null) throw new Error(`API exited early: ${output}`);
  }
  assert.ok(response, `API did not start: ${output}`);
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.database, 'not_configured');
  const preflight = await fetch(`${base}/api/auth/login`, { method: 'OPTIONS', headers: { Origin: 'https://anime-hub-bangla-two.vercel.app', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://anime-hub-bangla-two.vercel.app');
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com', password: 'example' }) });
  assert.equal(login.status, 503); // Missing database should return a useful error, not a network failure.
  const catalogue = await fetch(`${base}/api/anime`);
  assert.equal(catalogue.status, 503);
  const homepage = await fetch(`${base}/api/cms/public/homepage`);
  assert.equal(homepage.status, 503);
  const settingsUpdate = await fetch(`${base}/api/admin/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ showMovies: false }) });
  assert.equal(settingsUpdate.status, 401);
  const paymentRequest = await fetch(`${base}/api/user/membership/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'MONTHLY', paymentMethod: 'BKASH', transactionReference: 'test-reference', amountBdt: 1 }) });
  assert.equal(paymentRequest.status, 401);
  const coverUpload = await fetch(`${base}/api/admin/media/cover`, { method: 'POST' });
  assert.equal(coverUpload.status, 401);
  const protectedRoute = await fetch(`${base}/api/admin/anime`);
  assert.equal(protectedRoute.status, 401);
  const badToken = await fetch(`${base}/api/admin/anime`, { headers: { Authorization: 'Bearer invalid' } });
  assert.equal(badToken.status, 401);
  console.log('API smoke tests passed (no database configured).');
} finally {
  child.kill();
}
