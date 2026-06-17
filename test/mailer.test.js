import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Outbox } from '../outbox.js';
import { drainOutbox, renderEmail } from '../mailer.js';

function ob() { return new Outbox(fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-mail-'))); }
const CTX = {
  programs: { 'cybersecurity-blueteam': { name: 'Cybersecurity', degree: 'A.A.S.', sheetUrl: 'https://example.test/blue.pdf' } },
  archetypes: { cyber: { name: 'The Defender', blurb: 'You spot weaknesses first.' } },
  infoSessionUrl: 'https://forms.example.test/info',
};

test('renderEmail (program-only) includes program name and sheet link', () => {
  const { subject, html } = renderEmail({ programId: 'cybersecurity-blueteam' }, CTX);
  assert.match(subject, /Cybersecurity/);
  assert.match(html, /https:\/\/example\.test\/blue\.pdf/);
  assert.ok(!/IT HERO/i.test(html), 'no hero block without worldId');
});

test('renderEmail (hero) includes the IT-hero name, blurb, program sheet, and info-session link', () => {
  const { subject, html } = renderEmail({ programId: 'cybersecurity-blueteam', worldId: 'cyber' }, CTX);
  assert.match(subject, /The Defender/);
  assert.match(html, /IT HERO/i);
  assert.match(html, /The Defender/);
  assert.match(html, /You spot weaknesses first/);
  assert.match(html, /https:\/\/example\.test\/blue\.pdf/);
  assert.match(html, /https:\/\/forms\.example\.test\/info/);
});

test('drainOutbox sends pending and marks them sent', async () => {
  const box = ob();
  box.appendLead({ email: 'a@b.edu', programId: 'cybersecurity-blueteam', worldId: 'cyber' });
  const sent = [];
  const transport = { send: async (msg) => { sent.push(msg); } };
  const n = await drainOutbox(box, transport, CTX);
  assert.equal(n, 1);
  assert.equal(sent[0].to, 'a@b.edu');
  assert.match(sent[0].subject, /The Defender/);
  assert.equal(box.pending().length, 0);
});

test('drainOutbox leaves entries pending when transport throws (offline)', async () => {
  const box = ob();
  box.appendLead({ email: 'a@b.edu', programId: 'cybersecurity-blueteam' });
  const transport = { send: async () => { throw new Error('offline'); } };
  const n = await drainOutbox(box, transport, CTX);
  assert.equal(n, 0);
  assert.equal(box.pending().length, 1);
});
