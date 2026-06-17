// Model-specific "known weak spots" knowledge base for popular UK used cars,
// plus a generic checklist that applies to every car. The matcher is fuzzy on
// make/model so partial DVLA/MOT data still produces useful guidance.

/**
 * Each entry lists the well-known failure points for a model family. `match`
 * is checked (case-insensitively) against "make model" so e.g. "BMW 320d"
 * matches the "bmw 3 series" entry.
 */
export const MODEL_FAULTS = [
  {
    match: ['ford fiesta'],
    faults: [
      { area: 'engine', severity: 'high', issue: 'Wet-belt (1.0 EcoBoost) cambelt runs in oil and degrades — can shed debris and block the oil pump.', checkFor: 'Oil-change history every 10k/1yr, rattling on cold start, oil pressure warning.' },
      { area: 'cooling', severity: 'high', issue: '1.0 EcoBoost coolant degas pipe / thermostat housing failures causing overheating.', checkFor: 'Coolant level, mayonnaise under oil cap, temperature gauge behaviour.' },
      { area: 'clutch', severity: 'medium', issue: 'Powershift automatic (older) shudder; manual clutch judder.', checkFor: 'Shudder pulling away, gear selection.' },
    ],
  },
  {
    match: ['ford focus'],
    faults: [
      { area: 'engine', severity: 'high', issue: '1.0/1.5 EcoBoost wet-belt and coolant intrusion issues.', checkFor: 'Service history, coolant loss, white smoke.' },
      { area: 'transmission', severity: 'medium', issue: 'Powershift dual-clutch auto (2011-2016) shuddering and clutch faults.', checkFor: 'Hesitation, jerky shifts.' },
      { area: 'suspension', severity: 'low', issue: 'Rear suspension arm bushes wear.', checkFor: 'Knocking over bumps.' },
    ],
  },
  {
    match: ['vauxhall corsa', 'opel corsa'],
    faults: [
      { area: 'electrical', severity: 'medium', issue: 'Electric power steering column failures; intermittent steering assist loss.', checkFor: 'Heavy/notchy steering, EPS warning light.' },
      { area: 'engine', severity: 'medium', issue: '1.2/1.4 timing chain stretch and rattle.', checkFor: 'Rattle on start-up, engine management light.' },
      { area: 'body', severity: 'low', issue: 'Rear arch and sill corrosion on older cars.', checkFor: 'Bubbling paint around arches.' },
    ],
  },
  {
    match: ['vauxhall astra', 'opel astra'],
    faults: [
      { area: 'engine', severity: 'medium', issue: '1.4/1.6 turbo timing chain and water pump issues.', checkFor: 'Chain rattle, coolant loss.' },
      { area: 'electrical', severity: 'medium', issue: 'Electric power steering and BCM faults.', checkFor: 'Warning lights, electrical gremlins.' },
    ],
  },
  {
    match: ['volkswagen golf', 'vw golf'],
    faults: [
      { area: 'transmission', severity: 'high', issue: 'DSG (DQ200 7-speed dry clutch) mechatronic and clutch failures.', checkFor: 'Jerky low-speed shifts, DSG service history (every ~40k for wet clutch).' },
      { area: 'engine', severity: 'medium', issue: '1.4 TSI timing chain tensioner (pre-2013) and oil consumption on EA888.', checkFor: 'Chain rattle on start, oil top-up frequency.' },
      { area: 'engine', severity: 'medium', issue: 'Diesel DPF clogging on cars used for short trips; AdBlue faults.', checkFor: 'DPF/glow plug light, regen behaviour.' },
    ],
  },
  {
    match: ['volkswagen polo', 'vw polo'],
    faults: [
      { area: 'engine', severity: 'medium', issue: '1.2 TSI timing chain stretch and water pump.', checkFor: 'Chain rattle, coolant level.' },
      { area: 'transmission', severity: 'medium', issue: 'DSG dry-clutch shudder.', checkFor: 'Low-speed jerkiness.' },
    ],
  },
  {
    match: ['bmw 3 series', 'bmw 320', 'bmw 318', 'bmw 330', 'bmw 316'],
    faults: [
      { area: 'engine', severity: 'high', issue: 'N47 diesel timing chain (rear-mounted) failure — expensive engine-out repair.', checkFor: 'Rattle from rear of engine on cold start, especially 2007-2014.' },
      { area: 'cooling', severity: 'medium', issue: 'Plastic cooling components (water pump, thermostat, expansion tank) fail.', checkFor: 'Coolant leaks, overheating.' },
      { area: 'electrical', severity: 'low', issue: 'iDrive/electrical niggles and battery registration after replacement.', checkFor: 'Warning messages.' },
    ],
  },
  {
    match: ['bmw 1 series', 'bmw 116', 'bmw 118', 'bmw 120'],
    faults: [
      { area: 'engine', severity: 'high', issue: 'N47 diesel timing chain failure; petrol high-pressure fuel pump faults.', checkFor: 'Cold-start rattle, hesitation.' },
      { area: 'cooling', severity: 'medium', issue: 'Water pump and thermostat failures.', checkFor: 'Coolant loss.' },
    ],
  },
  {
    match: ['mercedes a-class', 'mercedes-benz a'],
    faults: [
      { area: 'transmission', severity: 'medium', issue: '7G-DCT dual-clutch jerkiness and mechatronic faults.', checkFor: 'Low-speed shifts, service history.' },
      { area: 'engine', severity: 'medium', issue: 'Renault-sourced 1.5 diesel injector/turbo issues on some models.', checkFor: 'Smoke, power loss.' },
    ],
  },
  {
    match: ['audi a3'],
    faults: [
      { area: 'engine', severity: 'medium', issue: 'EA888 oil consumption (piston rings) and 1.4 TSI chain tensioner.', checkFor: 'Oil top-ups, chain rattle.' },
      { area: 'transmission', severity: 'high', issue: 'S tronic/DSG clutch and mechatronic failures.', checkFor: 'Shudder, jerky shifts, gearbox service.' },
    ],
  },
  {
    match: ['nissan qashqai'],
    faults: [
      { area: 'transmission', severity: 'high', issue: 'CVT (Xtronic) overheating and failure, especially earlier units.', checkFor: 'Whine, judder, slipping, transmission warning.' },
      { area: 'engine', severity: 'medium', issue: '1.5 dCi diesel DPF and turbo issues; 1.2 DIG-T timing chain.', checkFor: 'DPF light, chain rattle.' },
    ],
  },
  {
    match: ['toyota yaris', 'toyota corolla', 'toyota auris', 'toyota prius'],
    faults: [
      { area: 'hybrid', severity: 'medium', issue: 'Hybrid battery degradation on high-mileage/older cars; inverter coolant pump.', checkFor: 'Hybrid health check, warning lights, battery state.' },
      { area: 'body', severity: 'low', issue: 'Generally very reliable; watch corrosion on older models.', checkFor: 'Underbody rust.' },
    ],
  },
  {
    match: ['mini cooper', 'mini one', 'mini hatch'],
    faults: [
      { area: 'engine', severity: 'high', issue: 'Timing chain (N12/N14/N18) rattle and tensioner failure; carbon build-up on direct injection.', checkFor: 'Death rattle on cold start.' },
      { area: 'cooling', severity: 'medium', issue: 'Water pump and thermostat housing leaks.', checkFor: 'Coolant loss.' },
      { area: 'clutch', severity: 'medium', issue: 'Clutch wear and dual-mass flywheel.', checkFor: 'Judder, biting point.' },
    ],
  },
  {
    match: ['land rover', 'range rover'],
    faults: [
      { area: 'electrical', severity: 'high', issue: 'Notorious electrical faults, air suspension, and infotainment failures.', checkFor: 'Air suspension levelling, warning messages, all electrics.' },
      { area: 'engine', severity: 'high', issue: '2.7/3.0 TDV6 crankshaft and timing belt (wet belt on Ingenium) issues.', checkFor: 'Service history, oil condition, rattles.' },
    ],
  },
];

/** Generic high-value inspection areas that apply to every used car. */
export const GENERIC_INSPECTION = [
  { area: 'engine-bay', title: 'Engine bay (cold)', media: 'photo', importance: 'high',
    instructions: 'Photograph the whole bay with the engine cold. Capture the oil filler cap underside (look for mayonnaise/sludge), coolant reservoir level & colour, and any obvious leaks or fresh cleaning that may hide a leak.' },
  { area: 'engine-running', title: 'Engine running / cold start', media: 'video', importance: 'high',
    instructions: 'Film the very first cold start of the day from key-turn, then idle for 30s. Listen for rattles, knocks, ticking. Watch the exhaust for blue (oil), white (coolant/head gasket) or black (fuel) smoke.' },
  { area: 'exhaust-smoke', title: 'Exhaust under load', media: 'video', importance: 'medium',
    instructions: 'Film the exhaust tip while a helper revs to ~3000rpm and on the test drive. Persistent smoke is a red flag.' },
  { area: 'dashboard-lights', title: 'Dashboard on ignition', media: 'video', importance: 'high',
    instructions: 'Film the dash from ignition-on through engine start. All warning lights should illuminate then extinguish. Note any that stay on (engine, ABS, airbag, oil, battery, DPF).' },
  { area: 'bodywork-panels', title: 'Body panels & paint', media: 'photo', importance: 'high',
    instructions: 'Photograph each panel along its length in good light. Look for mismatched paint, overspray, uneven panel gaps, ripples (accident repair) and bubbling/rust around arches, sills and the boot floor.' },
  { area: 'tyres', title: 'All four tyres + spare', media: 'photo', importance: 'medium',
    instructions: 'Photograph tread of each tyre and the inner/outer edges. Uneven wear suggests alignment/suspension issues. Note brand mismatch and DOT age. Min legal tread is 1.6mm.' },
  { area: 'underside', title: 'Underside & sills', media: 'photo', importance: 'high',
    instructions: 'Photograph the sills, subframe, suspension mounts and exhaust for corrosion, fresh underseal hiding rust, or fluid leaks. Corrosion here is an MOT structural failure.' },
  { area: 'interior-wear', title: 'Interior wear vs mileage', media: 'photo', importance: 'high',
    instructions: 'Photograph the driver seat bolster, steering wheel, gear knob and pedal rubbers. Heavy wear on a "low mileage" car is a clocking warning sign.' },
  { area: 'odometer', title: 'Odometer reading', media: 'photo', importance: 'high',
    instructions: 'Photograph the dashboard odometer clearly. Compare against the recorded MOT mileages.' },
  { area: 'service-book', title: 'Service book & receipts', media: 'photo', importance: 'high',
    instructions: 'Photograph the service book stamps and any invoices, plus the cambelt/timing chain change record if applicable.' },
  { area: 'vin-plate', title: 'VIN / chassis plate', media: 'photo', importance: 'high',
    instructions: 'Photograph the VIN plate (door jamb/under bonnet) and the windscreen-etched VIN. They must match each other and the V5C logbook.' },
  { area: 'test-drive', title: 'Test drive', media: 'video', importance: 'high',
    instructions: 'Film a drive including a cold start, low and motorway speeds. Note: pulling to one side, vibrations, gearbox shifts, clutch bite, brake feel, clunks over bumps, and any dash lights appearing.' },
];

const norm = (s) => (s || '').toString().toLowerCase().trim();

/**
 * Returns the merged set of known faults for a given make/model. Matching is
 * fuzzy: an entry matches if any of its `match` strings is contained in the
 * combined "make model" string.
 */
export function findModelFaults(make, model) {
  const hay = `${norm(make)} ${norm(model)}`.replace(/\s+/g, ' ').trim();
  const out = [];
  for (const entry of MODEL_FAULTS) {
    if (entry.match.some((m) => hay.includes(m))) {
      out.push(...entry.faults);
    }
  }
  return out;
}
