// Analyses MOT/service history to surface red flags: mileage tampering
// (clocking), recurring/structural advisories, failure rate, and currency of
// the MOT. Designed to work on the shape returned by the DVSA MOT History API
// (and our normalised fallback data).

const toDate = (s) => (s ? new Date(s) : null);

/** Normalise odometer to miles. */
function miles(test) {
  const v = Number(test.odometerValue);
  if (!Number.isFinite(v)) return null;
  const unit = (test.odometerUnit || 'mi').toLowerCase();
  return unit.startsWith('k') ? Math.round(v * 0.621371) : v;
}

const RUST_RE = /(corro|rust|structural|underbody|subframe|sill|chassis)/i;
const STRUCTURAL_DEFECT = /(brake|steering|suspension|tyre|ty?re|emission)/i;

/**
 * @param {Array} motTests  DVSA-shaped tests (newest first or any order)
 * @returns {object} analysis with flags[], mileageHistory[], stats
 */
export function analyseMotHistory(motTests = []) {
  const flags = [];
  const tests = [...motTests]
    .map((t) => ({
      date: toDate(t.completedDate || t.testDate),
      result: (t.testResult || t.result || '').toUpperCase(),
      expiry: t.expiryDate,
      miles: miles(t),
      defects: t.rfrAndComments || t.defects || t.comments || [],
    }))
    .filter((t) => t.date)
    .sort((a, b) => a.date - b.date); // oldest -> newest

  const mileageHistory = tests
    .filter((t) => t.miles != null)
    .map((t) => ({ date: t.date.toISOString().slice(0, 10), miles: t.miles, result: t.result }));

  // --- Mileage / clocking analysis ---
  let clockingDetected = false;
  for (let i = 1; i < mileageHistory.length; i++) {
    const prev = mileageHistory[i - 1];
    const cur = mileageHistory[i];
    if (cur.miles < prev.miles - 50) {
      clockingDetected = true;
      flags.push({
        type: 'mileage',
        severity: 'critical',
        title: 'Possible odometer tampering (clocking)',
        detail: `Recorded mileage dropped from ${prev.miles.toLocaleString()} (${prev.date}) to ${cur.miles.toLocaleString()} (${cur.date}). Mileage should never decrease.`,
      });
    }
    // Implausible single-year jump
    const years = (toDate(cur.date) - toDate(prev.date)) / (365.25 * 864e5);
    if (years > 0.2) {
      const perYear = (cur.miles - prev.miles) / years;
      if (perYear > 40000) {
        flags.push({
          type: 'mileage',
          severity: 'info',
          title: 'Very high annual mileage in a period',
          detail: `~${Math.round(perYear).toLocaleString()} miles/yr between ${prev.date} and ${cur.date}. Often ex-fleet/motorway miles — not necessarily bad, but confirm.`,
        });
      }
    }
  }

  const totalMiles = mileageHistory.length ? mileageHistory[mileageHistory.length - 1].miles : null;

  // --- Advisory / defect analysis ---
  const advisoryText = [];
  let rustMentions = 0;
  let failCount = 0;
  let passCount = 0;
  const recurring = new Map();

  for (const t of tests) {
    if (t.result === 'PASSED' || t.result === 'PASS') passCount++;
    if (t.result === 'FAILED' || t.result === 'FAIL') failCount++;
    for (const d of t.defects) {
      const text = (d.text || d.comment || d).toString();
      const type = (d.type || (/(fail)/i.test(t.result) ? 'FAIL' : 'ADVISORY')).toString().toUpperCase();
      advisoryText.push({ date: t.date.toISOString().slice(0, 10), type, text });
      if (RUST_RE.test(text)) rustMentions++;
      // Track recurring topics (first 4 significant words)
      const key = text.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 3).join(' ');
      if (key) recurring.set(key, (recurring.get(key) || 0) + 1);
    }
  }

  if (rustMentions >= 1) {
    flags.push({
      type: 'corrosion',
      severity: rustMentions >= 3 ? 'high' : 'medium',
      title: 'Corrosion noted in MOT history',
      detail: `${rustMentions} corrosion-related advisory/defect mention(s). Inspect sills, subframe and brake lines closely — structural rust is costly and an MOT failure.`,
    });
  }

  for (const [key, count] of recurring) {
    if (count >= 3) {
      flags.push({
        type: 'recurring',
        severity: 'medium',
        title: 'Recurring unresolved issue',
        detail: `"${key}" appears in ${count} separate MOTs — suggests a problem repeatedly patched but not fixed, or general neglect.`,
      });
    }
  }

  if (tests.length) {
    const failRate = failCount / tests.length;
    if (failRate >= 0.5 && tests.length >= 3) {
      flags.push({
        type: 'failures',
        severity: 'medium',
        title: 'High MOT failure rate',
        detail: `Failed ${failCount} of ${tests.length} tests. May indicate the car is run close to the wire each year.`,
      });
    }
  }

  // --- MOT currency ---
  const latest = tests[tests.length - 1];
  let motCurrent = null;
  let daysToExpiry = null;
  if (latest?.expiry) {
    const exp = toDate(latest.expiry);
    daysToExpiry = Math.round((exp - new Date()) / 864e5);
    motCurrent = daysToExpiry > 0;
    if (!motCurrent) {
      flags.push({
        type: 'mot',
        severity: 'high',
        title: 'MOT appears to be expired',
        detail: `Latest MOT expired ${Math.abs(daysToExpiry)} days ago (${latest.expiry}). Driving it (other than to a pre-booked test) is illegal and it may need work to pass.`,
      });
    } else if (daysToExpiry < 60) {
      flags.push({
        type: 'mot',
        severity: 'info',
        title: 'MOT due soon',
        detail: `MOT expires in ${daysToExpiry} days. Use it as a negotiation point or ask for a fresh MOT.`,
      });
    }
  }

  return {
    flags,
    mileageHistory,
    advisories: advisoryText,
    stats: {
      tests: tests.length,
      passes: passCount,
      failures: failCount,
      totalMiles,
      clockingDetected,
      rustMentions,
      motCurrent,
      daysToExpiry,
    },
  };
}
