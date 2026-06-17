import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLDS, worldForProgram, validateWorldMap } from '../world-map.js';

const ALL_IDS = [
  'softwareeng-app-dev','softwareeng-full-stack',
  'artificial-intelligence','dataanalysis-analysis','dataanalysis-visualization','dataanalysis-google',
  'cybersecurity-blueteam','cybersecurity-redteam','cybersecurity-forensics','cloud-networking',
  'sgd-programming','sgd-design','sgd-3d-modeling',
  'it-technical-support',
];

test('there are exactly 5 worlds, each with color + text + name', () => {
  assert.equal(WORLDS.length, 5);
  for (const w of WORLDS) {
    assert.match(w.color, /^#[0-9A-Fa-f]{6}$/);
    assert.match(w.text, /^#[0-9A-Fa-f]{6}$/);
    assert.ok(w.name.length > 0);
    assert.ok(Array.isArray(w.programIds));
  }
});

test('every program id maps to exactly one world', () => {
  const seen = new Map();
  for (const w of WORLDS) for (const id of w.programIds) {
    assert.ok(!seen.has(id), `duplicate mapping for ${id}`);
    seen.set(id, w.id);
  }
  for (const id of ALL_IDS) assert.ok(seen.has(id), `unmapped program: ${id}`);
  assert.equal(seen.size, ALL_IDS.length, 'world map has extra/unknown ids');
});

test('worldForProgram returns the owning world', () => {
  assert.equal(worldForProgram('cloud-networking').id, 'cyber');
  assert.equal(worldForProgram('artificial-intelligence').id, 'data');
  assert.equal(worldForProgram('nope'), undefined);
});

test('validateWorldMap throws on missing coverage', () => {
  assert.throws(() => validateWorldMap([...ALL_IDS, 'extra-prog']), /extra-prog/);
  assert.doesNotThrow(() => validateWorldMap(ALL_IDS));
});
