import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyseMotHistory } from '../src/analysis.js';
import { findModelFaults } from '../src/knowledge.js';
import { buildInspectionPlan } from '../src/inspection.js';
import { buildSellerQuestions } from '../src/questions.js';
import { buildVerdict } from '../src/valuation.js';
import { DEMO } from '../src/dvla.js';

test('analysis detects clocking when mileage decreases', () => {
  const a = analyseMotHistory([
    { completedDate: '2022-01-01', testResult: 'PASSED', odometerValue: '90000', odometerUnit: 'mi', rfrAndComments: [] },
    { completedDate: '2023-01-01', testResult: 'PASSED', odometerValue: '60000', odometerUnit: 'mi', rfrAndComments: [] },
  ]);
  assert.ok(a.stats.clockingDetected, 'should flag clocking');
  assert.ok(a.flags.some((f) => f.type === 'mileage' && f.severity === 'critical'));
});

test('analysis flags corrosion and recurring issues from demo BMW', () => {
  const a = analyseMotHistory(DEMO.XY68ZZZ.motTests);
  assert.ok(a.flags.some((f) => f.type === 'corrosion'), 'corrosion flag');
  assert.ok(a.stats.clockingDetected, 'BMW demo has a mileage drop (clocking)');
  assert.ok(a.mileageHistory.length >= 4);
});

test('clean Toyota demo has no critical flags', () => {
  const a = analyseMotHistory(DEMO.AB12CDE.motTests);
  assert.equal(a.stats.clockingDetected, false);
  assert.ok(!a.flags.some((f) => f.severity === 'critical'));
});

test('km odometer is converted to miles', () => {
  const a = analyseMotHistory([
    { completedDate: '2023-01-01', testResult: 'PASSED', odometerValue: '100000', odometerUnit: 'km', rfrAndComments: [] },
  ]);
  assert.equal(a.mileageHistory[0].miles, 62137);
});

test('model faults match fuzzily on make+model', () => {
  assert.ok(findModelFaults('BMW', '320d M Sport').some((f) => /timing chain/i.test(f.issue)));
  assert.ok(findModelFaults('Ford', 'Fiesta 1.0 EcoBoost').some((f) => /wet-belt/i.test(f.issue)));
  assert.equal(findModelFaults('Lada', 'Riva').length, 0);
});

test('inspection plan includes generic + model + MOT-driven items', () => {
  const a = analyseMotHistory(DEMO.XY68ZZZ.motTests);
  const plan = buildInspectionPlan(DEMO.XY68ZZZ.vehicle, a);
  assert.ok(plan.items.length > 12);
  assert.ok(plan.items.some((i) => i.source === 'generic'));
  assert.ok(plan.items.some((i) => i.source === 'model'));
  assert.ok(plan.items.some((i) => i.source === 'mot'));
  // high priority sorted first
  assert.equal(plan.items[0].importance, 'high');
});

test('seller questions include MOT advisory and model follow-ups', () => {
  const a = analyseMotHistory(DEMO.XY68ZZZ.motTests);
  const { questions, redFlagFollowUps } = buildSellerQuestions(DEMO.XY68ZZZ.vehicle, a);
  assert.ok(questions.length >= 10);
  assert.ok(questions.some((q) => q.source === 'model'));
  assert.ok(redFlagFollowUps.some((q) => /mileage|corrosion/i.test(q.q)));
});

test('verdict: AVOID when clocking present', () => {
  const a = analyseMotHistory(DEMO.XY68ZZZ.motTests);
  const v = buildVerdict({ vehicle: DEMO.XY68ZZZ.vehicle, analysis: a, askingPrice: 8000 });
  assert.equal(v.verdict, 'AVOID');
  assert.ok(v.riskScore >= 60 || v.riskBand === 'high');
});

test('verdict: GOOD_CANDIDATE for clean car with fair price guidance', () => {
  const a = analyseMotHistory(DEMO.AB12CDE.motTests);
  const v = buildVerdict({ vehicle: DEMO.AB12CDE.vehicle, analysis: a, askingPrice: 10000, marketAverage: 10500 });
  assert.equal(v.verdict, 'GOOD_CANDIDATE');
  assert.equal(v.priceGuidance.askingPrice, 10000);
  assert.ok(v.priceGuidance.suggestedMaxPrice <= 10000);
  assert.ok(v.priceGuidance.suggestedOpeningOffer <= v.priceGuidance.suggestedMaxPrice);
});

test('verdict: reported issues add deductions and risk', () => {
  const a = analyseMotHistory(DEMO.AB12CDE.motTests);
  const v = buildVerdict({
    vehicle: DEMO.AB12CDE.vehicle, analysis: a, askingPrice: 10000,
    reportedIssues: [{ area: 'engine', severity: 'high', costKey: 'timing_chain', note: 'chain rattle' }],
  });
  assert.ok(v.priceGuidance.totalDeductions >= 1200);
  assert.ok(v.riskBreakdown.some((r) => r.source === 'inspection'));
});

test('verdict: critical reported issue forces AVOID', () => {
  const a = analyseMotHistory(DEMO.AB12CDE.motTests);
  const v = buildVerdict({
    vehicle: DEMO.AB12CDE.vehicle, analysis: a,
    reportedIssues: [{ area: 'engine', severity: 'critical', costKey: 'head_gasket', note: 'head gasket' }],
  });
  assert.equal(v.verdict, 'AVOID');
});
