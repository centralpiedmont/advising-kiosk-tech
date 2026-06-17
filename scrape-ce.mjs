// Refresh kiosk/ce.json from the live CPCC Continuing Education catalog.
// Pulls every course in the IT (Live Instructor Sessions) program area and refreshes
// name, courseId, price (reg + tech fee), contact hours, and description.
// SAFETY: it will NEVER write a smaller/empty catalog — if the live listing returns
// fewer than 70% of the courses already in ce.json (or none), it aborts with no changes.
// Curated category grouping is preserved; new courses go to "More IT Training";
// courses no longer offered are dropped (logged). Node 20+, global fetch, no deps.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRAM_AREA_ID = '21614430';
const BASE = 'https://continuinged.cpcc.edu';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const JAR = path.join(os.tmpdir(), `ce-cookies-${process.pid}.txt`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The CE site (Augusoft Lumens) blocks Node's fetch but serves curl fine; use curl
// with a shared cookie jar so the session persists across the listing + detail pages.
async function getText(url, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const out = execFileSync('curl', [
        '-sL', '--compressed', '--max-time', '25', '-A', UA,
        '-H', 'Accept-Language: en-US,en;q=0.9', '-c', JAR, '-b', JAR, url,
      ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      if (out && out.length > 1500) return out;
      lastErr = new Error(`thin body (${out ? out.length : 0}b)`);
    } catch (e) { lastErr = e; }
    await sleep(900 * (i + 1));
  }
  throw lastErr || new Error('fetch failed: ' + url);
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&rsquo;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

async function scrapeListing() {
  const html = await getText(`${BASE}/public/category/programArea.do?method=load&selectedProgramAreaId=${PROGRAM_AREA_ID}`);
  // code -> courseId from the course anchors
  const ids = {};
  const idRe = /courseId=(\d+)[^"]*">\s*<span class=['"]courseCode['"]>\s*([A-Z]{3}-[A-Z]{2,3}\d{4})\s*<\/span>/g;
  let m;
  while ((m = idRe.exec(html))) ids[m[2]] = m[1];
  // code -> name from the page's flat "CODE - Name" course list
  const text = decode(html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '));
  const names = {};
  const nameRe = /([A-Z]{3}-[A-Z]{2,3}\d{4})\s*-\s*(.+?)(?=\s+[A-Z]{3}-[A-Z]{2,3}\d{4}\s*-|\s+Session Time-Out|\s+Powered by|\s+Privacy|\s+Required fields|\s+Contact Us|\s+CPCC\.EDU|\s+Visit\b|$)/g;
  while ((m = nameRe.exec(text))) names[m[1]] = m[2].trim().replace(/[.\s]+$/, '');
  return Object.keys(ids).map((code) => ({ code, courseId: ids[code], name: names[code] || code }));
}

async function scrapeDetail(courseId) {
  const html = await getText(`${BASE}/search/publicCourseSearchDetails.do?method=load&courseId=${courseId}`);
  const text = decode(html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '));
  const reg = text.match(/Course Fee\(s\)[\s\S]*?\$\s?([\d,]+(?:\.\d{2})?)/);
  const tech = text.match(/TECH Fee\s*\$\s?([\d,]+(?:\.\d{2})?)/);
  const hrs = text.match(/Contact Hours\s*([\d.]+)/);
  const dm = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const money = (s) => Number(s.replace(/,/g, ''));
  return {
    price: reg ? Math.round(money(reg[1]) + (tech ? money(tech[1]) : 0)) : null,
    hours: hrs ? Math.round(Number(hrs[1])) : null,
    desc: dm ? decode(dm[1]) : '',
  };
}

(async () => {
  const cePath = path.join(__dirname, 'ce.json');
  const ce = JSON.parse(fs.readFileSync(cePath, 'utf8'));
  const catOf = {};
  let existingCount = 0;
  for (const cat of ce.categories) for (const c of cat.courses) { catOf[c.code] = cat.name; existingCount++; }

  const listing = await scrapeListing();
  console.log(`Listing: ${listing.length} courses (have ${existingCount}).`);

  // SAFETY GUARD — refuse to shrink/empty the catalog on a bad scrape.
  const floor = Math.max(5, Math.floor(existingCount * 0.7));
  if (listing.length < floor) {
    console.error(`ABORT: live listing (${listing.length}) below safety floor (${floor}). ce.json left unchanged.`);
    process.exit(1);
  }

  const prevByCode = Object.fromEntries(ce.categories.flatMap((c) => c.courses).map((c) => [c.code, c]));
  const fresh = {};
  let failures = 0;
  for (const item of listing) {
    try {
      const d = await scrapeDetail(item.courseId);
      const prev = prevByCode[item.code];
      // keep curated short display name + keep prior desc if the page lost it
      fresh[item.code] = { code: item.code, name: prev?.name || item.name, courseId: item.courseId,
        price: d.price, hours: d.hours, desc: d.desc || prev?.desc || '' };
    } catch (e) {
      failures++;
      console.log(`  ${item.code}: detail error (${String(e.message).slice(0, 40)}) — keeping existing if present`);
      // fall back to whatever we already have for this code so we don't lose data
      const prev = ce.categories.flatMap((c) => c.courses).find((c) => c.code === item.code);
      fresh[item.code] = prev ? { ...prev, name: item.name, courseId: item.courseId } : { code: item.code, name: item.name, courseId: item.courseId, price: null, hours: null, desc: '' };
    }
    await sleep(350);
  }
  if (failures > listing.length / 2) {
    console.error(`ABORT: ${failures}/${listing.length} detail pages failed. ce.json left unchanged.`);
    process.exit(1);
  }

  const MORE = 'More IT Training';
  const cats = ce.categories.map((cat) => ({ name: cat.name, courses: [] }));
  const byName = Object.fromEntries(cats.map((c) => [c.name, c]));
  const used = new Set();
  for (const cat of ce.categories) for (const c of cat.courses) {
    if (fresh[c.code]) { byName[cat.name].courses.push(fresh[c.code]); used.add(c.code); }
  }
  const added = [];
  for (const code of Object.keys(fresh)) {
    if (used.has(code)) continue;
    if (!byName[MORE]) { const m = { name: MORE, courses: [] }; cats.push(m); byName[MORE] = m; }
    byName[MORE].courses.push(fresh[code]); added.push(code);
  }
  const removed = Object.keys(catOf).filter((c) => !fresh[c]);
  ce.categories = cats.filter((c) => c.courses.length);

  fs.writeFileSync(cePath, JSON.stringify(ce, null, 2) + '\n');
  const total = ce.categories.reduce((a, c) => a + c.courses.length, 0);
  console.log(`Wrote ce.json — ${total} courses across ${ce.categories.length} categories.`);
  if (added.length) console.log(`  + new (review category): ${added.join(', ')}`);
  if (removed.length) console.log(`  - dropped: ${removed.join(', ')}`);
})().catch((e) => { console.error('Scrape failed:', e.message, '\nce.json left unchanged.'); process.exit(1); });
