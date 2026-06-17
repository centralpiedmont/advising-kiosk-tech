// The 5 kiosk "worlds" (first-tap). Presentation layer — intentionally decoupled
// from the print `family` field in sheets.json (which files AI alone and puts Data
// Analysis under appdev). Colors per cpcc-branding: Gray/Gold dominant, Blue accent,
// Purple is the <=10% accent (Games only). Dark text on gold, white elsewhere.
export const WORLDS = [
  { id: 'apps',  name: 'Build Apps & Software',
    desc: 'Code websites, mobile apps, and software',
    color: '#005D83', text: '#FFFFFF',
    programIds: ['softwareeng-app-dev', 'softwareeng-full-stack'] },
  { id: 'data',  name: 'Work with Data & AI',
    desc: 'Turn data into insight and build AI',
    color: '#54565A', text: '#FFFFFF',
    programIds: ['artificial-intelligence', 'dataanalysis-analysis', 'dataanalysis-visualization', 'dataanalysis-google'] },
  { id: 'cyber', name: 'Cyber & Networks',
    desc: 'Defend systems and run networks',
    color: '#B4A269', text: '#1A1A1A',
    programIds: ['cybersecurity-blueteam', 'cybersecurity-redteam', 'cybersecurity-forensics', 'cloud-networking'] },
  { id: 'games', name: 'Games & 3D',
    desc: 'Create games, animation, and 3D worlds',
    color: '#672666', text: '#FFFFFF',
    programIds: ['sgd-programming', 'sgd-design', 'sgd-3d-modeling'] },
  { id: 'start', name: 'Not sure — start with IT Support',
    desc: 'New to tech? Start with the essentials',
    color: '#54565A', text: '#FFFFFF',
    programIds: ['it-technical-support'] },
];

export function worldForProgram(id) {
  return WORLDS.find((w) => w.programIds.includes(id));
}

// Throws if the live program list and the world map disagree (extra or missing ids).
export function validateWorldMap(allIds) {
  const mapped = new Set(WORLDS.flatMap((w) => w.programIds));
  const missing = allIds.filter((id) => !mapped.has(id));
  const extra = [...mapped].filter((id) => !allIds.includes(id));
  if (missing.length || extra.length) {
    throw new Error(`world-map mismatch — missing: [${missing}] extra: [${extra}]`);
  }
}
