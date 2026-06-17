// Builds a tailored inspection plan: which areas the buyer should photograph /
// film, prioritised by (a) generic high-value checks, (b) the model's known
// weak spots, and (c) anything the MOT history flagged as concerning.

import { GENERIC_INSPECTION, findModelFaults } from './knowledge.js';

const AREA_MEDIA = {
  engine: { media: 'video', title: 'Engine — model-specific check' },
  cooling: { media: 'photo', title: 'Cooling system' },
  transmission: { media: 'video', title: 'Transmission / gearbox' },
  clutch: { media: 'video', title: 'Clutch' },
  electrical: { media: 'video', title: 'Electrical systems' },
  suspension: { media: 'video', title: 'Suspension' },
  body: { media: 'photo', title: 'Bodywork / corrosion' },
  hybrid: { media: 'photo', title: 'Hybrid system' },
};

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

/**
 * @param {object} vehicle  normalised vehicle
 * @param {object} analysis result of analyseMotHistory()
 * @returns {{items: Array, summary: object}}
 */
export function buildInspectionPlan(vehicle = {}, analysis = { flags: [] }) {
  const items = [];

  // 1) Generic checks (always).
  for (const g of GENERIC_INSPECTION) {
    items.push({
      id: `generic:${g.area}`,
      area: g.area,
      title: g.title,
      media: g.media,
      importance: g.importance,
      reason: 'Standard high-value check for any used car.',
      instructions: g.instructions,
      source: 'generic',
    });
  }

  // 2) Model-specific weak spots.
  const faults = findModelFaults(vehicle.make, vehicle.model);
  faults.forEach((f, i) => {
    const meta = AREA_MEDIA[f.area] || { media: 'photo', title: f.area };
    items.push({
      id: `model:${f.area}:${i}`,
      area: f.area,
      title: `${meta.title} — known weak spot`,
      media: meta.media,
      importance: f.severity === 'high' ? 'high' : f.severity === 'medium' ? 'medium' : 'low',
      reason: `Known issue on ${[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'this model'}: ${f.issue}`,
      instructions: `Specifically check: ${f.checkFor}`,
      source: 'model',
    });
  });

  // 3) MOT-driven targeted checks.
  for (const flag of analysis.flags || []) {
    if (flag.type === 'corrosion') {
      items.push({
        id: 'mot:corrosion',
        area: 'underside',
        title: 'Corrosion follow-up (flagged in MOT)',
        media: 'photo',
        importance: 'high',
        reason: flag.detail,
        instructions: 'Get clear, close photos of the sills, jacking points, subframe, suspension mounts and brake/fuel lines. Tap suspect areas — flaking rust is far worse than surface rust.',
        source: 'mot',
      });
    }
    if (flag.type === 'recurring') {
      items.push({
        id: 'mot:recurring',
        area: 'engine',
        title: 'Recurring MOT issue follow-up',
        media: 'video',
        importance: 'high',
        reason: flag.detail,
        instructions: 'Document the area mentioned repeatedly in the MOTs and ask the seller what was actually repaired (with receipts).',
        source: 'mot',
      });
    }
    if (flag.type === 'mileage' && flag.severity === 'critical') {
      items.push({
        id: 'mot:clocking',
        area: 'odometer',
        title: 'Clocking verification',
        media: 'photo',
        importance: 'high',
        reason: flag.detail,
        instructions: 'Photograph the current odometer, interior wear and service stamps. Cross-check every figure against the recorded MOT mileages before committing.',
        source: 'mot',
      });
    }
  }

  // De-duplicate by id, then sort by importance.
  const seen = new Set();
  const deduped = items.filter((it) => (seen.has(it.id) ? false : seen.add(it.id)));
  deduped.sort((a, b) => (rank(a.importance) - rank(b.importance)));

  const summary = {
    total: deduped.length,
    high: deduped.filter((i) => i.importance === 'high').length,
    photoCount: deduped.filter((i) => i.media === 'photo').length,
    videoCount: deduped.filter((i) => i.media === 'video').length,
    modelChecks: faults.length,
  };

  return { items: deduped, summary };
}

function rank(importance) {
  return { high: 0, medium: 1, low: 2 }[importance] ?? 3;
}

export { SEV_RANK };
