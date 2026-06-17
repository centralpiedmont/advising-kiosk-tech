import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKioskData } from '../generate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sheets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'build', 'sheets.json'), 'utf8'));
const careers = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'careers.json'), 'utf8'));

test('buildKioskData produces all 14 programs, each fully populated', () => {
  const data = buildKioskData(sheets, careers);
  assert.equal(Object.keys(data.programs).length, 14);
  const fs2 = data.programs['cybersecurity-blueteam'];
  assert.equal(fs2.world, 'cyber');
  assert.equal(fs2.degree, 'A.A.S.');
  assert.equal(fs2.semesters, 5);
  assert.equal(fs2.totalHours, 72);
  assert.ok(fs2.lead.length > 0 && !/[<>]/.test(fs2.lead));
  assert.ok(fs2.skills.length >= 3);
  assert.equal(fs2.careers[0].salaryText, '$129,180');
  assert.equal(fs2.heroFile, 'assets/heroes/cybersecurity-blueteam.jpg');
  assert.equal(fs2.qrFile, 'assets/qr/cybersecurity-blueteam.png');
  assert.equal(fs2.sheetUrl, 'https://frazier-at-cpcc.github.io/cpcc-it-degree-sheets/sheets/cybersecurity-blueteam.pdf');
  assert.ok(Array.isArray(fs2.planOfStudy) && fs2.planOfStudy[0].rows.length > 0);
});

test('worlds carry their programs in array order and brand colors', () => {
  const data = buildKioskData(sheets, careers);
  assert.equal(data.worlds.length, 5);
  const cyber = data.worlds.find((w) => w.id === 'cyber');
  assert.equal(cyber.color, '#B4A269');
  assert.deepEqual(cyber.programIds, ['cybersecurity-blueteam','cybersecurity-redteam','cybersecurity-forensics','cloud-networking']);
});

test('infoSession + meta present', () => {
  const data = buildKioskData(sheets, careers);
  assert.match(data.infoSession.url, /forms\.office\.com/);
  assert.equal(data.infoSession.qrFile, 'assets/qr/info-session.png');
  assert.ok(data.meta.generatedFrom.includes('sheets.json'));
});

test('range totalHours is preserved (not null) — artificial-intelligence', () => {
  const data = buildKioskData(sheets, careers);
  const ai = data.programs['artificial-intelligence'];
  assert.ok(ai.totalHours !== null && ai.totalHours !== undefined);
  assert.match(String(ai.totalHours), /\d/);
});

test('heroFile uses the real hero filename, and the file exists on disk', () => {
  const data = buildKioskData(sheets, careers);
  const its = data.programs['it-technical-support'];
  assert.equal(its.heroFile, 'assets/heroes/it-support.jpg');
  const heroPath = path.join(__dirname, '..', '..', 'build', its.heroFile);
  assert.ok(fs.existsSync(heroPath), `hero image missing: ${heroPath}`);
});

const ce = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ce.json'), 'utf8'));
test('buildKioskData attaches Continuing Education catalog when ce.json is provided', () => {
  const data = buildKioskData(sheets, careers, ce);
  assert.ok(data.ce, 'ce present');
  assert.equal(data.ce.categories.length, 5);
  const total = data.ce.categories.reduce((a, c) => a + c.courses.length, 0);
  assert.ok(total >= 22, `expected >=22 CE courses, got ${total}`); // grows as the live catalog adds courses
  assert.match(data.ce.registerUrl, /continuinged\.cpcc\.edu/);
  assert.equal(data.ce.qrFile, 'assets/qr/ce-register.png');
  // entities decoded, not double-escaped
  assert.ok(data.ce.categories.some((c) => c.name === 'Cloud & Networking'));
  assert.ok(!/&amp;/.test(JSON.stringify(data.ce)));
});

test('buildKioskData omits ce when not provided (back-compat)', () => {
  const data = buildKioskData(sheets, careers);
  assert.equal(data.ce, null);
});

const quiz = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'quiz.json'), 'utf8'));
test('buildKioskData attaches the quiz and validates answer worlds', () => {
  const data = buildKioskData(sheets, careers, ce, quiz);
  assert.ok(data.quiz, 'quiz present');
  assert.equal(data.quiz.questions.length, 6);
  assert.equal(Object.keys(data.quiz.archetypes).length, 5);
  const worldIds = new Set(data.worlds.map((w) => w.id));
  for (const q of data.quiz.questions) for (const a of q.answers) {
    assert.ok(worldIds.has(a.world), `answer world ${a.world} is a real world`);
    assert.ok(data.quiz.archetypes[a.world], `archetype exists for ${a.world}`);
  }
});

test('buildKioskData omits quiz when not provided (back-compat)', () => {
  const data = buildKioskData(sheets, careers, ce);
  assert.equal(data.quiz, null);
});
