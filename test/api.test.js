import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../server.js';

let server, base;
before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://localhost:${server.address().port}`;
});
after(() => server?.close());

const post = (path, body) => fetch(base + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('GET /api/health reports demo regs', async () => {
  const r = await fetch(base + '/api/health');
  const j = await r.json();
  assert.ok(j.ok);
  assert.ok(Array.isArray(j.demoRegs));
  assert.ok(j.demoRegs.includes('AB12CDE'));
});

test('POST /api/lookup returns full guidance bundle for demo reg', async () => {
  const r = await post('/api/lookup', { registration: 'XY68 ZZZ' });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.ok(j.found);
  assert.equal(j.vehicle.make, 'BMW');
  assert.ok(j.sessionId);
  assert.ok(j.analysis.flags.length > 0);
  assert.ok(j.inspection.items.length > 0);
  assert.ok(j.questions.length > 0);
});

test('POST /api/lookup requires a registration', async () => {
  const r = await post('/api/lookup', {});
  assert.equal(r.status, 400);
});

test('POST /api/manual builds guidance from entered details', async () => {
  const r = await post('/api/manual', { make: 'Mini', model: 'Cooper', year: 2016, fuelType: 'Petrol' });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.ok(j.inspection.items.some((i) => i.source === 'model'));
});

test('POST /api/verdict returns a recommendation', async () => {
  const lookup = await (await post('/api/lookup', { registration: 'AB12CDE' })).json();
  const r = await post('/api/verdict', {
    vehicle: lookup.vehicle, motTests: lookup.motTests, askingPrice: 9000, marketAverage: 9500,
  });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.ok(['AVOID', 'PROCEED_WITH_CAUTION', 'GOOD_CANDIDATE'].includes(j.verdict.verdict));
  assert.equal(j.verdict.priceGuidance.askingPrice, 9000);
});

test('POST /api/uploads requires a valid session', async () => {
  const r = await post('/api/uploads', { sessionId: 'nope' });
  // multipart not used here; multer still parses, route returns 404 for bad session
  assert.equal(r.status, 404);
});
