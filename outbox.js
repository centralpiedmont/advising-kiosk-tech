import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Outbox {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'outbox.jsonl');
    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, '');
  }
  _all() {
    return fs.readFileSync(this.file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }
  _writeAll(rows) {
    fs.writeFileSync(this.file, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  }
  appendLead({ email, programId, worldId }) {
    if (!EMAIL_RE.test(String(email || ''))) throw new Error('invalid email');
    const entry = { id: crypto.randomUUID(), email: String(email).trim(), programId: programId || '', worldId: worldId || '', ts: Date.now(), sent: false };
    fs.appendFileSync(this.file, JSON.stringify(entry) + '\n');
    return entry;
  }
  pending() { return this._all().filter((r) => !r.sent); }
  markSent(id) {
    const rows = this._all().map((r) => (r.id === id ? { ...r, sent: true, sentTs: Date.now() } : r));
    this._writeAll(rows);
  }
}
