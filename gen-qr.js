// Generates QR PNGs for the kiosk convert band:
//  - one per program → its GitHub-Pages-hosted degree sheet PDF
//  - one static info-session QR → the CPCC Microsoft Form
// Run: node gen-qr.js   (writes assets/qr/<id>.png + info-session.png)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PAGES_BASE = 'https://frazier-at-cpcc.github.io/cpcc-it-degree-sheets/sheets';
const INFO_SESSION_URL = 'https://forms.office.com/pages/responsepage.aspx?id=kftMRq3oAUCotWOPZymUNXQqV-xPK0xLl_usffYhEe1UNkNEWERTT1ZTOVlHVlJDUkg2REdaR1UyTC4u&route=shorturl';

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build', 'sheets.json'), 'utf8'));
const outDir = path.join(__dirname, 'assets', 'qr');
fs.mkdirSync(outDir, { recursive: true });

// High contrast + quiet zone for reliable phone scanning. Error correction 'M'.
const opts = { errorCorrectionLevel: 'M', margin: 3, width: 600, color: { dark: '#000000', light: '#FFFFFF' } };

(async () => {
  const manifest = [];
  for (const s of data.sheets) {
    const url = `${PAGES_BASE}/${s.id}.pdf`;
    await QRCode.toFile(path.join(outDir, `${s.id}.png`), url, opts);
    manifest.push({ id: s.id, type: 'degree-sheet', url });
  }
  await QRCode.toFile(path.join(outDir, 'info-session.png'), INFO_SESSION_URL, opts);
  manifest.push({ id: 'info-session', type: 'info-session', url: INFO_SESSION_URL });

  // Continuing Education — catalog register QR + one per-course registration QR
  const ce = JSON.parse(fs.readFileSync(path.join(__dirname, 'ce.json'), 'utf8'));
  await QRCode.toFile(path.join(outDir, 'ce-register.png'), ce.registerUrl, opts);
  manifest.push({ id: 'ce-register', type: 'ce-register', url: ce.registerUrl });
  const COURSE_BASE = 'https://continuinged.cpcc.edu/search/publicCourseSearchDetails.do?method=load&courseId=';
  for (const cat of ce.categories) for (const c of cat.courses) {
    if (!c.courseId) continue;
    const url = COURSE_BASE + c.courseId;
    await QRCode.toFile(path.join(outDir, `ce-${c.code}.png`), url, opts);
    manifest.push({ id: `ce-${c.code}`, type: 'ce-course', url });
  }

  fs.writeFileSync(path.join(outDir, 'qr-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Generated ${manifest.length} QR codes →`, path.relative(process.cwd(), outDir));
})();
