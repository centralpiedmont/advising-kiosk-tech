import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Outbox } from '../outbox.js';

function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-outbox-')); }

test('appendLead writes a pending entry with id + timestamp', () => {
  const ob = new Outbox(tmpdir());
  const entry = ob.appendLead({ email: 'a@b.edu', programId: 'cloud-networking' });
  assert.ok(entry.id);
  assert.equal(entry.email, 'a@b.edu');
  assert.equal(entry.sent, false);
  assert.equal(ob.pending().length, 1);
});

test('markSent moves an entry out of pending', () => {
  const ob = new Outbox(tmpdir());
  const e1 = ob.appendLead({ email: 'a@b.edu', programId: 'x' });
  ob.appendLead({ email: 'c@d.edu', programId: 'y' });
  ob.markSent(e1.id);
  assert.equal(ob.pending().length, 1);
  assert.equal(ob.pending()[0].email, 'c@d.edu');
});

test('rejects invalid email', () => {
  const ob = new Outbox(tmpdir());
  assert.throws(() => ob.appendLead({ email: 'not-an-email', programId: 'x' }), /email/i);
});

test('appendLead stores an optional worldId (quiz result email)', () => {
  const ob = new Outbox(tmpdir());
  const e = ob.appendLead({ email: 'a@b.edu', programId: 'cybersecurity-blueteam', worldId: 'cyber' });
  assert.equal(e.worldId, 'cyber');
  assert.equal(ob.pending()[0].worldId, 'cyber');
});

test('appendLead without worldId still works (back-compat)', () => {
  const ob = new Outbox(tmpdir());
  const e = ob.appendLead({ email: 'a@b.edu', programId: 'x' });
  assert.equal(e.worldId, '');
});
