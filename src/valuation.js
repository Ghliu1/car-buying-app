// Turns everything we know into a recommendation: AVOID / PROCEED WITH CAUTION /
// GOOD BUY, plus price guidance. The model is deliberately transparent — every
// point of risk and every pound of deduction is itemised so the buyer can see
// the reasoning and argue it with the seller.

const SEVERITY_POINTS = { critical: 50, high: 25, medium: 12, low: 5, info: 2 };

// Rough indicative repair costs (UK £, parts+labour, independent garage) used
// for price-deduction guidance. These are ballpark figures for negotiation,
// not quotes.
const REPAIR_COSTS = {
  timing_chain: 1200,
  timing_belt: 500,
  clutch: 900,
  dsg_clutch: 1400,
  cvt: 2500,
  turbo: 1300,
  dpf: 1000,
  head_gasket: 1500,
  cooling: 400,
  corrosion_structural: 1500,
  corrosion_surface: 300,
  brakes: 300,
  suspension: 350,
  hybrid_battery: 1500,
  tyres_set: 350,
  bodywork_panel: 600,
};

/**
 * @param {object} input
 * @param {object} input.vehicle
 * @param {object} input.analysis        analyseMotHistory() output
 * @param {Array}  [input.reportedIssues] user-confirmed problems, each:
 *        { area, severity?, costKey?, note? }
 * @param {number} [input.askingPrice]
 * @param {number} [input.marketAverage] optional typical market price for guide
 * @returns {object} verdict
 */
export function buildVerdict({ vehicle = {}, analysis = { flags: [] }, reportedIssues = [], askingPrice, marketAverage } = {}) {
  let riskPoints = 0;
  const riskBreakdown = [];
  const deductions = [];

  // 1) Points & deductions from MOT analysis flags.
  for (const flag of analysis.flags || []) {
    const pts = SEVERITY_POINTS[flag.severity] ?? 5;
    riskPoints += pts;
    riskBreakdown.push({ source: 'mot', title: flag.title, severity: flag.severity, points: pts });

    if (flag.type === 'corrosion') {
      const cost = flag.severity === 'high' ? REPAIR_COSTS.corrosion_structural : REPAIR_COSTS.corrosion_surface;
      deductions.push({ reason: 'Corrosion remediation noted in MOT history', amount: cost });
    }
    if (flag.type === 'mot' && /expired/i.test(flag.title)) {
      deductions.push({ reason: 'Fresh MOT / unknown failures', amount: 250 });
    }
  }

  // 2) Points & deductions from user-confirmed inspection findings.
  for (const issue of reportedIssues) {
    const sev = issue.severity || 'medium';
    const pts = SEVERITY_POINTS[sev] ?? SEVERITY_POINTS.medium;
    riskPoints += pts;
    riskBreakdown.push({ source: 'inspection', title: issue.note || issue.area, severity: sev, points: pts });
    if (issue.costKey && REPAIR_COSTS[issue.costKey]) {
      deductions.push({ reason: issue.note || `${issue.area} repair`, amount: REPAIR_COSTS[issue.costKey] });
    }
  }

  // 3) Mileage context (informational risk only).
  const totalMiles = analysis?.stats?.totalMiles;
  const age = vehicle.year ? new Date().getFullYear() - vehicle.year : null;
  let mileageNote = null;
  if (totalMiles != null && age != null && age > 0) {
    const perYear = Math.round(totalMiles / age);
    mileageNote = `~${perYear.toLocaleString()} miles/year (${totalMiles.toLocaleString()} over ${age} yrs). UK average is ~7,000–8,000.`;
    if (perYear > 18000) {
      riskPoints += 8;
      riskBreakdown.push({ source: 'mileage', title: 'High average mileage', severity: 'low', points: 8 });
    } else if (perYear < 2000 && age > 4) {
      riskPoints += 6;
      riskBreakdown.push({ source: 'mileage', title: 'Unusually low mileage — verify it is genuine', severity: 'low', points: 6 });
    }
  }

  // 4) Verdict band.
  let verdict, headline;
  const critical = (analysis.flags || []).some((f) => f.severity === 'critical')
    || reportedIssues.some((i) => i.severity === 'critical');
  if (critical || riskPoints >= 60) {
    verdict = 'AVOID';
    headline = 'Walk away unless you are an expert and the price reflects serious risk.';
  } else if (riskPoints >= 25) {
    verdict = 'PROCEED_WITH_CAUTION';
    headline = 'Potentially buyable, but get the flagged items checked and negotiate hard.';
  } else {
    verdict = 'GOOD_CANDIDATE';
    headline = 'No major red flags so far — complete the inspection, then buy at a fair price.';
  }

  // 5) Price guidance.
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  let priceGuidance = { totalDeductions, deductions };
  if (typeof askingPrice === 'number' && askingPrice > 0) {
    const fairMax = Math.max(0, askingPrice - totalDeductions);
    const openingOffer = Math.max(0, Math.round((fairMax * 0.9) / 50) * 50);
    priceGuidance.askingPrice = askingPrice;
    priceGuidance.suggestedMaxPrice = Math.round(fairMax);
    priceGuidance.suggestedOpeningOffer = openingOffer;
    if (typeof marketAverage === 'number' && marketAverage > 0) {
      priceGuidance.marketAverage = marketAverage;
      priceGuidance.vsMarket = Math.round(askingPrice - marketAverage);
      priceGuidance.marketNote = askingPrice > marketAverage
        ? `Asking is £${Math.round(askingPrice - marketAverage).toLocaleString()} above the typical market price you gave.`
        : `Asking is £${Math.round(marketAverage - askingPrice).toLocaleString()} below the typical market price — check why it is cheap.`;
    }
  }

  return {
    verdict,
    headline,
    riskScore: riskPoints,
    riskBand: riskPoints >= 60 ? 'high' : riskPoints >= 25 ? 'medium' : 'low',
    riskBreakdown: riskBreakdown.sort((a, b) => b.points - a.points),
    mileageNote,
    priceGuidance,
    disclaimer: 'Guidance only — indicative repair costs are UK ballpark figures, not quotes. Always confirm finance/theft status (HPI) and consider a professional inspection before buying.',
  };
}

export { REPAIR_COSTS };
