// Front-end controller for the guided buying flow.
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => (s == null ? '' : String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

const state = { sessionId: null, vehicle: null, motTests: [], analysis: null, reportedIssues: [] };

// ---- step navigation ----
function showStep(n) {
  document.querySelectorAll('.step').forEach((s) => s.classList.add('hidden'));
  $(`#step-${n}`).classList.remove('hidden');
  document.querySelectorAll('.steps span').forEach((sp) => {
    const step = Number(sp.dataset.step);
    sp.classList.toggle('active', step === n);
    sp.classList.toggle('done', step < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('.next').forEach((b) => b.addEventListener('click', () => showStep(Number(b.dataset.goto))));

// ---- health / demo hint ----
fetch('/api/health').then((r) => r.json()).then((h) => {
  $('#footerNote').textContent = h.liveLookup
    ? 'Live DVLA/DVSA lookup enabled. Guidance only — not a substitute for a professional inspection or HPI check.'
    : 'Demo mode (no DVLA/DVSA keys). Guidance only — not a substitute for a professional inspection or HPI check.';
  if (!h.liveLookup && h.demoRegs?.length) {
    $('#demoHint').innerHTML = `Demo mode — try these registrations: ${h.demoRegs.map((r) => `<b>${esc(r)}</b>`).join(', ')}`;
  }
}).catch(() => {});

// ---- lookup ----
async function handleLookup(payload, url) {
  const status = $('#lookupStatus');
  status.className = 'status'; status.textContent = 'Looking up…';
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lookup failed');
    if (!data.found) { status.className = 'status error'; status.textContent = data.vehicle?.note || 'Not found — try manual entry.'; return; }
    applyData(data);
    status.textContent = '';
    showStep(2);
  } catch (e) {
    status.className = 'status error'; status.textContent = e.message;
  }
}

$('#lookupBtn').addEventListener('click', () => {
  const reg = $('#reg').value.trim();
  if (!reg) { $('#lookupStatus').className = 'status error'; $('#lookupStatus').textContent = 'Enter a registration.'; return; }
  handleLookup({ registration: reg }, '/api/lookup');
});
$('#reg').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#lookupBtn').click(); });

$('#manualBtn').addEventListener('click', () => {
  handleLookup({
    make: $('#m-make').value, model: $('#m-model').value,
    year: $('#m-year').value, fuelType: $('#m-fuel').value,
  }, '/api/manual');
});

// ---- render everything from lookup response ----
function applyData(data) {
  state.sessionId = data.sessionId;
  state.vehicle = data.vehicle;
  state.motTests = data.motTests || [];
  state.analysis = data.analysis;
  renderVehicle(data.vehicle, data);
  renderFlags(data.analysis);
  renderMileage(data.analysis);
  renderAdvisories(data.analysis);
  renderInspection(data.inspection);
  renderQuestions(data.questions, data.redFlagFollowUps);
  renderFindings(data.inspection);
}

function renderVehicle(v, data) {
  const fields = [
    ['Registration', v.registration], ['Make', v.make], ['Model', v.model],
    ['Year', v.year], ['Fuel', v.fuelType], ['Colour', v.colour],
    ['Engine', v.engineCapacity ? v.engineCapacity + 'cc' : null],
    ['Tax', v.taxStatus], ['MOT status', v.motStatus], ['MOT expires', v.motExpiryDate],
  ].filter(([, val]) => val != null && val !== '');
  const wrap = $('#vehicleSummary'); wrap.innerHTML = '';
  const grid = el('div', 'kv');
  fields.forEach(([k, val]) => {
    const d = el('div'); d.appendChild(el('div', 'label', esc(k))); d.appendChild(el('div', 'value', esc(val)));
    grid.appendChild(d);
  });
  wrap.appendChild(grid);
  if (data.source === 'demo') wrap.appendChild(el('p', 'hint', 'Demo data shown (no live API keys configured).'));
  if (data.source === 'manual') wrap.appendChild(el('p', 'hint', 'Manually entered — add MOT data via a live lookup for full history analysis.'));
}

function renderFlags(analysis) {
  const wrap = $('#flags'); wrap.innerHTML = '';
  const flags = analysis.flags || [];
  if (!flags.length) {
    wrap.appendChild(el('div', 'ok-banner', '✓ No automatic red flags found in the available history. Still complete the physical inspection.'));
  }
  flags.forEach((f) => {
    const d = el('div', `flag ${f.severity}`);
    d.appendChild(el('div', 'fs', esc(f.severity)));
    d.appendChild(el('div', 'ft', esc(f.title)));
    d.appendChild(el('div', null, esc(f.detail)));
    wrap.appendChild(d);
  });
  const s = analysis.stats || {};
  wrap.appendChild(el('p', 'hint', `${s.tests || 0} MOT tests · ${s.passes || 0} pass · ${s.failures || 0} fail` + (s.totalMiles != null ? ` · latest recorded ${s.totalMiles.toLocaleString()} mi` : '')));
}

function renderMileage(analysis) {
  const wrap = $('#mileageChart'); wrap.innerHTML = '';
  const hist = analysis.mileageHistory || [];
  if (!hist.length) { wrap.innerHTML = '<span class="hint">No mileage data available.</span>'; return; }
  const max = Math.max(...hist.map((h) => h.miles), 1);
  hist.forEach((h, i) => {
    const bar = el('div', 'bar');
    const drop = i > 0 && h.miles < hist[i - 1].miles;
    if (drop) bar.classList.add('drop');
    bar.style.height = `${Math.max(4, (h.miles / max) * 100)}%`;
    bar.appendChild(el('span', null, (h.miles / 1000).toFixed(0) + 'k'));
    bar.appendChild(el('small', null, esc(h.date.slice(0, 7))));
    wrap.appendChild(bar);
  });
}

function renderAdvisories(analysis) {
  const wrap = $('#advisories'); wrap.innerHTML = '';
  const adv = analysis.advisories || [];
  if (!adv.length) { wrap.innerHTML = '<p class="hint">No advisories recorded.</p>'; return; }
  adv.slice().reverse().forEach((a) => {
    wrap.appendChild(el('div', 'flag low', `<span class="fs">${esc(a.date)} · ${esc(a.type)}</span>${esc(a.text)}`));
  });
}

function renderInspection(inspection) {
  const wrap = $('#inspectionList'); wrap.innerHTML = '';
  const s = inspection.summary || {};
  wrap.appendChild(el('p', 'hint', `${s.total} checks (${s.high} high priority) · ${s.photoCount} photos · ${s.videoCount} videos · ${s.modelChecks} model-specific.`));
  (inspection.items || []).forEach((it) => {
    const d = el('div', `insp ${it.importance}`);
    const head = el('div', 'ih');
    const cb = el('input'); cb.type = 'checkbox'; cb.id = 'chk-' + it.id;
    head.appendChild(cb);
    head.appendChild(el('strong', null, esc(it.title)));
    head.appendChild(el('span', 'badge', it.media === 'video' ? '🎬 video' : '📷 photo'));
    head.appendChild(el('span', 'badge', esc(it.importance)));
    if (it.source !== 'generic') head.appendChild(el('span', `badge src-${it.source}`, it.source === 'model' ? 'model fault' : 'from MOT'));
    d.appendChild(head);
    d.appendChild(el('div', 'reason', esc(it.reason)));
    d.appendChild(el('div', 'instr', esc(it.instructions)));
    // upload control
    const up = el('div', 'up');
    const file = el('input'); file.type = 'file'; file.multiple = true; file.accept = 'image/*,video/*';
    const st = el('span', 'hint', '');
    file.addEventListener('change', () => uploadFiles(it.area, file.files, st, cb));
    up.appendChild(file); up.appendChild(st);
    d.appendChild(up);
    wrap.appendChild(d);
  });
}

async function uploadFiles(area, files, statusEl, cb) {
  if (!files?.length || !state.sessionId) return;
  statusEl.textContent = 'Uploading…';
  const fd = new FormData();
  fd.append('sessionId', state.sessionId);
  fd.append('area', area);
  for (const f of files) fd.append('files', f);
  try {
    const res = await fetch('/api/uploads', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    statusEl.textContent = `✓ ${data.uploaded.length} uploaded`;
    if (cb) cb.checked = true;
  } catch (e) { statusEl.textContent = e.message; }
}

function renderQuestions(questions, followUps) {
  const fu = $('#redFlagFollowUps'); fu.innerHTML = '';
  (followUps || []).forEach((f) => {
    fu.appendChild(el('div', 'followup', `<strong>⚠ ${esc(f.q)}</strong><div class="why">${esc(f.why)}</div>`));
  });
  const ol = $('#questionList'); ol.innerHTML = '';
  (questions || []).forEach((q) => {
    const li = el('li');
    li.appendChild(el('div', null, esc(q.q)));
    li.appendChild(el('div', 'why', esc(q.why)));
    ol.appendChild(li);
  });
}

// Findings → reported issues (with cost keys for price deductions).
const FINDING_OPTIONS = [
  { area: 'engine', costKey: 'timing_chain', severity: 'high', label: 'Timing chain/belt rattle or no record of change' },
  { area: 'engine', costKey: 'head_gasket', severity: 'critical', label: 'White smoke / mayo under oil cap (head gasket)' },
  { area: 'transmission', costKey: 'dsg_clutch', severity: 'high', label: 'Jerky / shuddering automatic (DSG/DCT)' },
  { area: 'transmission', costKey: 'cvt', severity: 'critical', label: 'CVT whine / slip' },
  { area: 'clutch', costKey: 'clutch', severity: 'medium', label: 'Clutch slipping / high biting point' },
  { area: 'cooling', costKey: 'cooling', severity: 'medium', label: 'Coolant leak / overheating' },
  { area: 'turbo', costKey: 'turbo', severity: 'high', label: 'Turbo whistle / blue smoke' },
  { area: 'dpf', costKey: 'dpf', severity: 'medium', label: 'DPF / emissions warning (diesel)' },
  { area: 'body', costKey: 'corrosion_structural', severity: 'high', label: 'Structural corrosion (sills/subframe)' },
  { area: 'body', costKey: 'bodywork_panel', severity: 'medium', label: 'Accident damage / mismatched panel' },
  { area: 'brakes', costKey: 'brakes', severity: 'low', label: 'Worn brakes / scored discs' },
  { area: 'suspension', costKey: 'suspension', severity: 'low', label: 'Knocking suspension / uneven tyre wear' },
  { area: 'tyres', costKey: 'tyres_set', severity: 'low', label: 'Tyres near legal limit / mismatched' },
  { area: 'hybrid', costKey: 'hybrid_battery', severity: 'high', label: 'Hybrid battery health warning' },
  { area: 'docs', severity: 'high', label: 'No V5C / VIN mismatch / outstanding finance' },
];

function renderFindings() {
  const wrap = $('#findings'); wrap.innerHTML = '';
  FINDING_OPTIONS.forEach((o, i) => {
    const lab = el('label');
    const cb = el('input'); cb.type = 'checkbox'; cb.dataset.idx = i;
    lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + o.label));
    wrap.appendChild(lab);
  });
}

// ---- verdict ----
$('#verdictBtn').addEventListener('click', async () => {
  const reported = [];
  $('#findings').querySelectorAll('input:checked').forEach((cb) => {
    const o = FINDING_OPTIONS[Number(cb.dataset.idx)];
    reported.push({ area: o.area, severity: o.severity, costKey: o.costKey, note: o.label });
  });
  const payload = {
    vehicle: state.vehicle,
    motTests: state.motTests,
    reportedIssues: reported,
    askingPrice: $('#askingPrice').value ? Number($('#askingPrice').value) : undefined,
    marketAverage: $('#marketAverage').value ? Number($('#marketAverage').value) : undefined,
  };
  const res = await fetch('/api/verdict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  renderVerdict(data.verdict);
});

function renderVerdict(v) {
  const wrap = $('#verdict'); wrap.innerHTML = '';
  const labels = { AVOID: '🚫 AVOID', PROCEED_WITH_CAUTION: '⚠ PROCEED WITH CAUTION', GOOD_CANDIDATE: '✓ GOOD CANDIDATE' };
  const box = el('div', `verdict-box ${v.verdict}`);
  box.appendChild(el('div', 'vtitle', labels[v.verdict] || v.verdict));
  box.appendChild(el('div', null, esc(v.headline)));
  box.appendChild(el('div', 'hint', `Risk score ${v.riskScore} (${esc(v.riskBand)})`));
  wrap.appendChild(box);

  if (v.mileageNote) wrap.appendChild(el('p', 'hint', esc(v.mileageNote)));

  if (v.riskBreakdown?.length) {
    const h = el('h3', null, 'What drove this'); wrap.appendChild(h);
    v.riskBreakdown.forEach((r) => {
      wrap.appendChild(el('div', `flag ${r.severity}`, `<span class="fs">${esc(r.source)} · ${r.points} pts</span>${esc(r.title)}`));
    });
  }

  const pg = v.priceGuidance || {};
  const pc = el('div', 'price-card');
  pc.appendChild(el('h3', null, 'Price guidance'));
  if (pg.deductions?.length) {
    pg.deductions.forEach((d) => pc.appendChild(el('div', 'deduction', `<span>${esc(d.reason)}</span><span>-£${d.amount.toLocaleString()}</span>`)));
    pc.appendChild(el('div', 'deduction', `<span><b>Total deductions</b></span><span><b>-£${pg.totalDeductions.toLocaleString()}</b></span>`));
  } else {
    pc.appendChild(el('p', 'hint', 'No specific repair deductions identified.'));
  }
  if (pg.askingPrice != null) {
    pc.appendChild(el('p', null, `Asking price: £${pg.askingPrice.toLocaleString()}`));
    if (pg.marketNote) pc.appendChild(el('p', 'hint', esc(pg.marketNote)));
    pc.appendChild(el('p', null, `Fair maximum to pay: <span class="big">£${pg.suggestedMaxPrice.toLocaleString()}</span>`));
    pc.appendChild(el('p', null, `Suggested opening offer: <b>£${pg.suggestedOpeningOffer.toLocaleString()}</b>`));
  } else {
    pc.appendChild(el('p', 'hint', 'Enter an asking price for tailored offer figures.'));
  }
  wrap.appendChild(pc);
  wrap.appendChild(el('p', 'disclaimer', esc(v.disclaimer)));
}
