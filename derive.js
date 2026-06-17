const ENTITIES = {
  '&amp;': '&',
  '&mdash;': '—',
  '&ndash;': '–',
  '&rsquo;': "'",
  '&lsquo;': "'",
  '&rdquo;': '"',
  '&ldquo;': '"',
  '&nbsp;': ' ',
  '&hellip;': '…',
  '&eacute;': 'é',
};

export function stripHtml(html = '') {
  let s = String(html).replace(/<[^>]+>/g, ' ');
  for (const [k, v] of Object.entries(ENTITIES)) s = s.split(k).join(v);
  return s.replace(/\s+/g, ' ').trim();
}

export function degreeLabel(title = '') {
  const t = title.toLowerCase();
  if (t.includes('associate in applied science')) return 'A.A.S.';
  if (t.includes('associate in arts')) return 'A.A.';
  if (t.includes('associate in science')) return 'A.S.';
  if (t.includes('diploma')) return 'Diploma';
  if (/^certificate\b/i.test(title.trim()) || /\bcertificate program\b/i.test(t)) return 'Certificate';
  return title;
}

export function shortLead(overviewHtml = '', cap = 180) {
  const text = stripHtml(overviewHtml);
  const firstSentence = (text.match(/^.*?[.!?](\s|$)/)?.[0] || text).trim();
  if (firstSentence.length <= cap) return firstSentence;
  return text.slice(0, cap - 1).trimEnd() + '…';
}

export function formatSalary(n) {
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// "What you'll learn" narrative — the program overview's second paragraph (which
// typically describes the hands-on coursework), falling back to the first.
export function learnNarrative(overviewHtml = '', cap = 360) {
  const paras = String(overviewHtml).split(/<\/p>/i).map((p) => stripHtml(p)).filter(Boolean);
  let pick = paras[1] || paras[0] || stripHtml(overviewHtml);
  if (pick.length > cap) pick = pick.slice(0, cap - 1).trimEnd() + '…';
  return pick;
}

// Gen-ed / support course prefixes to exclude from "What you'll learn".
const GENED = new Set(['ENG', 'MAT', 'PHI', 'PSY', 'ACA', 'CIS', 'HUM', 'SOC', 'COM', 'ART', 'SPA', 'BIO', 'CHM', 'HIS']);
export function skillChips(planOfStudy = [], max = 5) {
  const out = [];
  for (const term of planOfStudy) {
    for (const row of term.rows || []) {
      const prefix = (row.code || '').trim().split(/\s+/)[0];
      const name = stripHtml(row.name || '');
      if (!name || GENED.has(prefix)) continue;
      if (/elective/i.test(name)) continue;
      if (!out.includes(name)) out.push(name);
      if (out.length >= max) return out;
    }
  }
  return out;
}
