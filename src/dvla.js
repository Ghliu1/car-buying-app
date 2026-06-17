// Vehicle lookup. Uses the real DVLA Vehicle Enquiry Service (VES) for
// make/tax/MOT-status and the DVSA MOT History API for the full MOT record
// (including model + odometer + advisories) when API credentials are
// configured. Without credentials it falls back to a built-in demo dataset so
// the whole app remains runnable and demonstrable offline.
//
// Env vars:
//   DVLA_VES_API_KEY            – DVLA Vehicle Enquiry Service key
//   MOT_HISTORY_API_KEY         – DVSA MOT History API key (x-api-key)
//   MOT_HISTORY_CLIENT_ID       – OAuth client id
//   MOT_HISTORY_CLIENT_SECRET   – OAuth client secret
//   MOT_HISTORY_TOKEN_URL       – OAuth token endpoint (scope authority)
//   MOT_HISTORY_SCOPE           – OAuth scope

const VES_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const MOT_URL = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration';

function cleanReg(reg) {
  return (reg || '').toString().toUpperCase().replace(/\s+/g, '');
}

let cachedToken = null; // { token, expires }

async function getMotToken() {
  const { MOT_HISTORY_CLIENT_ID, MOT_HISTORY_CLIENT_SECRET, MOT_HISTORY_TOKEN_URL, MOT_HISTORY_SCOPE } = process.env;
  if (!MOT_HISTORY_CLIENT_ID || !MOT_HISTORY_CLIENT_SECRET || !MOT_HISTORY_TOKEN_URL) return null;
  if (cachedToken && cachedToken.expires > Date.now() + 30_000) return cachedToken.token;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: MOT_HISTORY_CLIENT_ID,
    client_secret: MOT_HISTORY_CLIENT_SECRET,
    scope: MOT_HISTORY_SCOPE || 'https://tapi.dvsa.gov.uk/.default',
  });
  const res = await fetch(MOT_HISTORY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`MOT token request failed: ${res.status}`);
  const json = await res.json();
  cachedToken = { token: json.access_token, expires: Date.now() + (json.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

async function fetchVes(reg) {
  const key = process.env.DVLA_VES_API_KEY;
  if (!key) return null;
  const res = await fetch(VES_URL, {
    method: 'POST',
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ registrationNumber: reg }),
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`DVLA VES failed: ${res.status}`);
  return res.json();
}

async function fetchMotHistory(reg) {
  const apiKey = process.env.MOT_HISTORY_API_KEY;
  if (!apiKey) return null;
  const token = await getMotToken();
  if (!token) return null;
  const res = await fetch(`${MOT_URL}/${encodeURIComponent(reg)}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-api-key': apiKey, Accept: 'application/json' },
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`MOT History failed: ${res.status}`);
  return res.json();
}

/**
 * Look up a vehicle by registration. Returns a normalised vehicle object plus
 * the data source. Falls back to demo data when credentials are missing.
 */
export async function lookupVehicle(registration) {
  const reg = cleanReg(registration);
  if (!reg) throw Object.assign(new Error('Registration required'), { status: 400 });

  const live = Boolean(process.env.DVLA_VES_API_KEY || process.env.MOT_HISTORY_API_KEY);

  if (!live) {
    const demo = DEMO[reg];
    return {
      source: 'demo',
      live: false,
      found: Boolean(demo),
      vehicle: demo
        ? demo.vehicle
        : { registration: reg, make: null, model: null, note: 'No live API key configured and this reg is not in the demo set. Enter the details manually.' },
      motTests: demo ? demo.motTests : [],
    };
  }

  const [ves, mot] = await Promise.allSettled([fetchVes(reg), fetchMotHistory(reg)]);
  const vesData = ves.status === 'fulfilled' && ves.value && !ves.value.notFound ? ves.value : null;
  const motData = mot.status === 'fulfilled' && mot.value && !mot.value.notFound ? mot.value : null;

  const vehicle = {
    registration: reg,
    make: motData?.make || vesData?.make || null,
    model: motData?.model || null,
    year: motData?.firstUsedDate ? Number(String(motData.firstUsedDate).slice(0, 4)) : vesData?.yearOfManufacture || null,
    colour: motData?.primaryColour || vesData?.colour || null,
    fuelType: motData?.fuelType || vesData?.fuelType || null,
    engineCapacity: vesData?.engineCapacity || null,
    co2Emissions: vesData?.co2Emissions || null,
    taxStatus: vesData?.taxStatus || null,
    taxDueDate: vesData?.taxDueDate || null,
    motStatus: vesData?.motStatus || null,
    motExpiryDate: vesData?.motExpiryDate || motData?.motTests?.[0]?.expiryDate || null,
  };

  return {
    source: 'live',
    live: true,
    found: Boolean(vesData || motData),
    vehicle,
    motTests: motData?.motTests || [],
  };
}

// ---- Demo dataset (used when no API credentials are present) ----
export const DEMO = {
  // A "good" example: consistent mileage, current MOT, minor advisories.
  AB12CDE: {
    vehicle: {
      registration: 'AB12CDE', make: 'Toyota', model: 'Yaris', year: 2018, colour: 'Silver',
      fuelType: 'Hybrid Electric', engineCapacity: 1490, co2Emissions: 92,
      taxStatus: 'Taxed', taxDueDate: '2026-09-01', motStatus: 'Valid', motExpiryDate: '2026-11-20',
    },
    motTests: [
      { completedDate: '2026-11-20', testResult: 'PASSED', expiryDate: '2027-11-19', odometerValue: '48210', odometerUnit: 'mi', rfrAndComments: [{ type: 'ADVISORY', text: 'Nearside front tyre worn close to legal limit' }] },
      { completedDate: '2025-11-18', testResult: 'PASSED', expiryDate: '2026-11-17', odometerValue: '41005', odometerUnit: 'mi', rfrAndComments: [] },
      { completedDate: '2024-11-15', testResult: 'PASSED', expiryDate: '2025-11-14', odometerValue: '33480', odometerUnit: 'mi', rfrAndComments: [{ type: 'ADVISORY', text: 'Brake disc lightly scored' }] },
      { completedDate: '2023-11-10', testResult: 'PASSED', expiryDate: '2024-11-09', odometerValue: '25900', odometerUnit: 'mi', rfrAndComments: [] },
    ],
  },
  // A "concerning" example: clocking, recurring corrosion, a fail.
  XY68ZZZ: {
    vehicle: {
      registration: 'XY68ZZZ', make: 'BMW', model: '320d M Sport', year: 2014, colour: 'Black',
      fuelType: 'Diesel', engineCapacity: 1995, co2Emissions: 119,
      taxStatus: 'Taxed', taxDueDate: '2026-07-01', motStatus: 'Valid', motExpiryDate: '2026-08-05',
    },
    motTests: [
      { completedDate: '2025-08-05', testResult: 'PASSED', expiryDate: '2026-08-04', odometerValue: '78000', odometerUnit: 'mi', rfrAndComments: [{ type: 'ADVISORY', text: 'Offside sill corrosion within acceptable limits' }, { type: 'ADVISORY', text: 'Front brake pads wearing thin' }] },
      { completedDate: '2024-07-30', testResult: 'PASSED', expiryDate: '2025-07-29', odometerValue: '112400', odometerUnit: 'mi', rfrAndComments: [{ type: 'ADVISORY', text: 'Nearside sill corrosion' }, { type: 'ADVISORY', text: 'Oil leak, slight' }] },
      { completedDate: '2023-07-25', testResult: 'FAILED', expiryDate: null, odometerValue: '104300', odometerUnit: 'mi', rfrAndComments: [{ type: 'FAIL', text: 'Nearside front suspension component corroded' }, { type: 'ADVISORY', text: 'Sill corrosion noted' }] },
      { completedDate: '2023-07-25', testResult: 'PASSED', expiryDate: '2024-07-24', odometerValue: '104350', odometerUnit: 'mi', rfrAndComments: [{ type: 'ADVISORY', text: 'Timing chain noise on cold start reported by tester' }] },
      { completedDate: '2022-07-20', testResult: 'PASSED', expiryDate: '2023-07-19', odometerValue: '95100', odometerUnit: 'mi', rfrAndComments: [{ type: 'ADVISORY', text: 'Corrosion to brake pipes' }] },
    ],
  },
};
