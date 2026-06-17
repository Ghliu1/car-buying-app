// Used Car Buying Guide — Express server.
//
// Pipeline:
//   1. POST /api/lookup          -> identify the exact car + pull MOT history
//   2. (lookup also returns)     -> analysis, inspection plan, seller questions
//   3. POST /api/uploads         -> stash photos/videos against a session
//   4. POST /api/verdict         -> buy / avoid / negotiate + price guidance
//
// Stateless apart from in-memory upload metadata (demo). Real APIs are used
// when credentials are present (see src/dvla.js); otherwise demo data is used.

import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

import { lookupVehicle, DEMO } from './src/dvla.js';
import { analyseMotHistory } from './src/analysis.js';
import { buildInspectionPlan } from './src/inspection.js';
import { buildSellerQuestions } from './src/questions.js';
import { buildVerdict } from './src/valuation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory upload metadata keyed by session id (demo only).
const sessions = new Map();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

/** Assemble the full guidance bundle from a lookup result. */
function buildGuidance(lookup) {
  const analysis = analyseMotHistory(lookup.motTests || []);
  const inspection = buildInspectionPlan(lookup.vehicle, analysis);
  const { questions, redFlagFollowUps } = buildSellerQuestions(lookup.vehicle, analysis);
  return { analysis, inspection, questions, redFlagFollowUps };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    liveLookup: Boolean(process.env.DVLA_VES_API_KEY || process.env.MOT_HISTORY_API_KEY),
    demoRegs: Object.keys(DEMO),
    date: new Date().toISOString().slice(0, 10),
  });
});

app.post('/api/lookup', async (req, res) => {
  try {
    const lookup = await lookupVehicle(req.body?.registration);
    const guidance = buildGuidance(lookup);
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { vehicle: lookup.vehicle, uploads: [], createdAt: Date.now() });
    res.json({ sessionId, ...lookup, ...guidance });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Manual entry path when the reg isn't found / no API key.
app.post('/api/manual', (req, res) => {
  const { make, model, year, fuelType, registration, motTests } = req.body || {};
  const vehicle = {
    registration: (registration || '').toUpperCase() || null,
    make: make || null, model: model || null,
    year: year ? Number(year) : null, fuelType: fuelType || null,
  };
  const lookup = { source: 'manual', live: false, found: true, vehicle, motTests: Array.isArray(motTests) ? motTests : [] };
  const guidance = buildGuidance(lookup);
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { vehicle, uploads: [], createdAt: Date.now() });
  res.json({ sessionId, ...lookup, ...guidance });
});

app.post('/api/uploads', upload.array('files', 20), (req, res) => {
  const { sessionId, area } = req.body || {};
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Unknown session' });
  const stored = (req.files || []).map((f) => ({
    id: crypto.randomUUID(),
    area: area || 'unspecified',
    name: f.originalname,
    type: f.mimetype,
    size: f.size,
    uploadedAt: Date.now(),
  }));
  session.uploads.push(...stored);
  res.json({ ok: true, uploaded: stored, totalForSession: session.uploads.length });
});

app.post('/api/verdict', (req, res) => {
  try {
    const { motTests = [], vehicle = {}, reportedIssues = [], askingPrice, marketAverage } = req.body || {};
    const analysis = analyseMotHistory(motTests);
    const verdict = buildVerdict({
      vehicle,
      analysis,
      reportedIssues,
      askingPrice: askingPrice != null ? Number(askingPrice) : undefined,
      marketAverage: marketAverage != null ? Number(marketAverage) : undefined,
    });
    res.json({ analysis, verdict });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
// Only listen when run directly (so tests can import without binding a port).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`Used Car Buying Guide running on http://localhost:${PORT}`);
    if (!process.env.DVLA_VES_API_KEY && !process.env.MOT_HISTORY_API_KEY) {
      console.log(`No DVLA/DVSA API keys set — using demo data. Try regs: ${Object.keys(DEMO).join(', ')}`);
    }
  });
}

export { app, buildGuidance };
