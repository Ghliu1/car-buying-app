// Generates the questions a buyer should put to the seller, tailored to the
// vehicle, its MOT history and its known weak spots.

import { findModelFaults } from './knowledge.js';

const BASE_QUESTIONS = [
  { q: 'Are you the registered keeper, and how long have you owned it?', why: 'A very short ownership period can indicate a "flip" or an undisclosed problem.' },
  { q: 'Why are you selling it?', why: 'Listen for vague or rehearsed answers.' },
  { q: 'Do you have the V5C logbook in your name, and does the VIN match?', why: 'Protects against stolen/cloned vehicles.' },
  { q: 'Is there any outstanding finance on the car?', why: 'If financed, it is not legally the seller’s to sell. Run an HPI/finance check.' },
  { q: 'Has it ever been in an accident or had any bodywork repaired?', why: 'Cross-check the answer against your panel/paint photos.' },
  { q: 'Do you have a full service history with receipts?', why: 'Documented servicing is the single best predictor of reliability.' },
  { q: 'When were the cambelt/timing chain, water pump and clutch last done?', why: 'Major scheduled items; missing records mean budgeting for them.' },
  { q: 'Can I see it started from cold, before you warm it up?', why: 'Many faults (rattles, smoke, hard starting) only show on a genuine cold start.' },
  { q: 'Is there a spare key, locking wheel-nut key, and all manuals?', why: 'Replacement keys are expensive and a missing key is a security risk.' },
  { q: 'Will you allow an independent inspection / AA-RAC check or a test at a garage?', why: 'A refusal is a major red flag.' },
];

/**
 * @param {object} vehicle
 * @param {object} analysis  analyseMotHistory() output
 * @returns {{questions: Array, redFlagFollowUps: Array}}
 */
export function buildSellerQuestions(vehicle = {}, analysis = { flags: [], advisories: [] }) {
  const questions = BASE_QUESTIONS.map((x) => ({ ...x, source: 'standard' }));

  // From recent advisories: ask whether they were addressed.
  const recentAdvisories = (analysis.advisories || []).slice(-4);
  for (const a of recentAdvisories) {
    questions.push({
      q: `The ${a.date} MOT noted: "${a.text}". Has that been sorted, and can I see proof?`,
      why: 'Confirms whether known advisories were actually repaired.',
      source: 'mot-advisory',
    });
  }

  // From model weak spots.
  const faults = findModelFaults(vehicle.make, vehicle.model);
  for (const f of faults) {
    questions.push({
      q: `This model can suffer ${f.issue.replace(/\.$/, '')}. Has this been checked or addressed on this car?`,
      why: `Known ${vehicle.make || ''} ${vehicle.model || ''} weak spot.`.trim(),
      source: 'model',
    });
  }

  // Red-flag-specific follow-ups.
  const redFlagFollowUps = [];
  for (const flag of analysis.flags || []) {
    if (flag.type === 'mileage' && flag.severity === 'critical') {
      redFlagFollowUps.push({
        q: 'The recorded mileage history is inconsistent — can you explain why the MOT mileage decreased, and provide every service invoice with mileages?',
        why: flag.detail,
      });
    }
    if (flag.type === 'corrosion') {
      redFlagFollowUps.push({
        q: 'Corrosion has been noted in the MOT history — has any welding or rust treatment been done, and by whom?',
        why: flag.detail,
      });
    }
    if (flag.type === 'mot' && flag.title.includes('expired')) {
      redFlagFollowUps.push({
        q: 'The MOT appears to have expired — are you willing to supply a fresh MOT before sale?',
        why: flag.detail,
      });
    }
  }

  return { questions, redFlagFollowUps };
}
