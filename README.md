# 🚗 Used Car Buying Guide

A guided web app that walks you through buying a second-hand car (UK-focused)
and ends with a clear **buy / avoid / negotiate** recommendation and price
guidance.

It follows the exact decision flow a careful buyer should take:

1. **Find the exact car** — enter the number plate. The app identifies the
   make, model, year, fuel, colour and engine, and pulls the tax & MOT status.
2. **Check its history** — it retrieves the full MOT record (every test,
   mileage and advisory) and **analyses it for red flags**: odometer tampering
   (clocking), structural corrosion, recurring unresolved faults, high failure
   rates and expiring MOTs. Mileage is charted over time.
3. **Inspect the right things** — it generates a **tailored photo/video
   checklist**. Every car gets the standard high-value checks (cold start,
   underside, paint, VIN, interior wear vs mileage, test drive…) *plus* checks
   for this model's known weak spots *plus* targeted follow-ups for anything the
   MOT history flagged. You can upload the media against the session.
4. **Ask the seller** — a tailored question list, including red-flag follow-ups
   (e.g. "explain why the MOT mileage decreased") and model-specific questions.
5. **Get the verdict** — tick the problems you actually found, enter the asking
   price, and get a transparent verdict with a risk score, an itemised list of
   what drove it, and **price guidance** (fair maximum to pay + suggested
   opening offer, with indicative repair-cost deductions).

## Run it

```bash
npm install
npm start
# open http://localhost:3000
```

Then try the demo registrations **`AB12CDE`** (a clean Toyota Yaris) and
**`XY68ZZZ`** (a BMW 320d with clocking + corrosion red flags).

Run the test suite:

```bash
npm test
```

## Live DVLA/DVSA data (optional)

Without API keys the app runs in **demo mode** with built-in sample data, so
the whole flow is usable offline. To enable live lookups, set these environment
variables (e.g. in a `.env` and export them, or in your process manager):

| Variable | Purpose |
| --- | --- |
| `DVLA_VES_API_KEY` | [DVLA Vehicle Enquiry Service](https://developer-portal.driver-vehicle-licensing.api.gov.uk/) — make, tax & MOT status |
| `MOT_HISTORY_API_KEY` | [DVSA MOT History API](https://documentation.history.mot.api.gov.uk/) `x-api-key` |
| `MOT_HISTORY_CLIENT_ID` / `MOT_HISTORY_CLIENT_SECRET` | OAuth client credentials for the MOT History API |
| `MOT_HISTORY_TOKEN_URL` | OAuth token endpoint |
| `MOT_HISTORY_SCOPE` | OAuth scope (defaults to the DVSA default scope) |

The DVSA MOT History API supplies the **model**, full MOT test list, odometer
readings and advisory text; DVLA VES supplies tax/MOT status and engine details.

## Architecture

```
server.js              Express server + API routes
src/dvla.js            Vehicle lookup (live DVLA VES + DVSA MOT API, demo fallback)
src/analysis.js        MOT history analysis: clocking, corrosion, recurring faults
src/knowledge.js       Model-specific weak-spot DB + generic inspection checklist
src/inspection.js      Builds the tailored photo/video inspection plan
src/questions.js       Generates seller questions + red-flag follow-ups
src/valuation.js       Risk scoring + buy/avoid verdict + price guidance
public/                Guided single-page front-end (vanilla JS)
test/                  node:test unit + API tests
```

### API

| Endpoint | Description |
| --- | --- |
| `POST /api/lookup` `{registration}` | Identify car + return analysis, inspection plan & questions |
| `POST /api/manual` `{make,model,year,fuelType}` | Same bundle from manually entered details |
| `POST /api/uploads` (multipart) | Attach photos/videos to the session |
| `POST /api/verdict` `{vehicle,motTests,reportedIssues,askingPrice,marketAverage}` | Final recommendation + price guidance |
| `GET /api/health` | Status + demo registrations |

## Disclaimer

This tool provides **guidance only**. Indicative repair costs are UK ballpark
figures, not quotes. Always run an HPI/finance & theft check and consider a
professional inspection (AA/RAC) before buying.
