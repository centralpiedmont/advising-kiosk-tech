import { KioskState } from './state.js';
import { mountKeyboard } from './keyboard.js';

const IDLE_MS = 60_000;
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const hexRgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const tileBg = (color, hero) => `background:linear-gradient(${hexRgba(color, .78)},${hexRgba(color, .93)}),url(${hero}) center/cover`;
const darken = (hex, f = 0.5) => { const n = parseInt(hex.slice(1), 16); const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); };
// Quiz icons via self-hosted FontAwesome (solid).
const ICONS = {
  compass: 'fa-compass',
  code: 'fa-code',
  chart: 'fa-chart-column',
  shield: 'fa-shield-halved',
  controller: 'fa-gamepad',
  wrench: 'fa-wrench',
};
const icon = (name) => (ICONS[name] ? `<i class="fa-solid ${ICONS[name]}" aria-hidden="true"></i>` : '');

const app = document.getElementById('app');
let state, data, idleTimer;

// Scale the fixed 1920x1080 design canvas to fill the actual panel resolution
// (uniform scale, centered — letterboxes only if the panel isn't 16:9).
const DESIGN_W = 1920, DESIGN_H = 1080;
function fitScreen() {
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  if (!vw || !vh) return; // ignore transient zero readings during boot
  const s = Math.min(vw / DESIGN_W, vh / DESIGN_H);
  const x = Math.round((vw - DESIGN_W * s) / 2);
  const y = Math.round((vh - DESIGN_H * s) / 2);
  app.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}
// Re-fit on every event that can change the reported panel size, plus delayed
// retries so a static kiosk display (which never fires resize) still converges.
['resize', 'orientationchange', 'load', 'pageshow'].forEach((ev) => window.addEventListener(ev, fitScreen));
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitScreen);
function fitWithRetries() { fitScreen(); requestAnimationFrame(fitScreen); [150, 500, 1500].forEach((ms) => setTimeout(fitScreen, ms)); }

function worldColor(id) { const w = data.worlds.find((x) => x.id === id); return w ? w.color : 'var(--gray)'; }
function worldText(id)  { const w = data.worlds.find((x) => x.id === id); return w ? w.text  : '#fff'; }

function render() {
  if (!state) return; // ignore emits during KioskState construction; boot() renders explicitly
  app.innerHTML = '';
  app.appendChild(SCREENS[state.screen]());
  if (state.overlay) app.appendChild(OVERLAYS[state.overlay]());
}

const SCREENS = {
  attract: () => el(`
    <section class="screen attract">
      <div class="topbar"><img src="assets/logo-white.png" alt="Central Piedmont"><div class="it">Information Technology</div></div>
      <div class="center">
        <div class="rule"></div>
        <h1>Conquer <span class="g">Possibility</span></h1>
        <p class="sub">Explore 14 IT degrees and find yours in three taps.</p>
        <button class="cta" id="start">Explore programs</button>
        <button class="cta-quiz" id="startquiz">Take the 1-minute career quiz</button>
      </div>
    </section>`),

  world: () => {
    const s = el(`<section class="screen world"><div class="bar"><button class="backbtn">Back</button><span class="bar-title">WHAT DO YOU WANT TO DO?</span><span class="bar-pad"></span></div><div class="tiles"></div></section>`);
    s.querySelector('.backbtn').onclick = () => state.goBack();
    const tiles = s.querySelector('.tiles');
    // 5 world bars in a horizontal row of vertical bars; CE (if any) is a full-width
    // horizontal banner across the bottom, set apart from the degree worlds.
    const row = el(`<div class="world-row"></div>`);
    tiles.appendChild(row);
    for (const w of data.worlds) {
      const t = el(`<button class="tile tile-${w.id}" style="color:${w.text}"><span class="tile-name">${esc(w.name)}</span><span class="tile-desc">${esc(w.desc)}</span></button>`);
      t.onclick = () => state.chooseWorld(w.id);
      row.appendChild(t);
    }
    if (data.ce) {
      const c = el(`<button class="tile tile-ce" style="color:${data.ce.text}"><span class="tile-name">${esc(data.ce.label)}</span><span class="tile-desc">${esc(data.ce.tileDesc)}</span></button>`);
      c.onclick = () => state.showCE();
      tiles.appendChild(c);
    }
    return s;
  },

  program: () => {
    const color = worldColor(state.worldId);
    const s = el(`<section class="screen program"><div class="bar" style="background:${color};color:${worldText(state.worldId)}"><button class="backbtn">Back</button><span class="bar-title">CHOOSE A PROGRAM</span><span class="bar-pad"></span></div><div class="tiles"></div></section>`);
    s.querySelector('.backbtn').onclick = () => state.goBack();
    const tiles = s.querySelector('.tiles');
    for (const p of state.currentPrograms()) {
      const shadow = p.tileText === '#FFFFFF' ? '0 2px 10px rgba(0,0,0,.4)' : 'none';
      const t = el(`<button class="tile" style="${tileBg(p.tileColor, p.heroFile)};color:${p.tileText};text-shadow:${shadow}"><span class="tile-name">${esc(p.name)}</span>${p.track ? `<span class="tile-track">${esc(p.track)}</span>` : ''}${p.tileDesc ? `<span class="tile-desc">${esc(p.tileDesc)}</span>` : ''}</button>`);
      t.onclick = () => state.chooseProgram(p.id);
      tiles.appendChild(t);
    }
    return s;
  },

  detail: () => detailView(state.current),
  courses: () => coursesView(state.current),
  ce: () => ceView(),
  'ce-detail': () => ceCourseView(state.ceCourse),
  quizIntro: () => quizIntroView(),
  quizQuestion: () => quizQuestionView(),
  quizSuspense: () => quizSuspenseView(),
  quizResult: () => quizResultView(),
};

function ceFooter(qrFile, bigText) {
  const band = el(`<div class="foot">
    <div class="qr" style="background-image:url(${qrFile})"></div>
    <div class="qtxt"><b>${bigText}</b><span>Central Piedmont Continuing Education — non-credit, financial aid options</span></div>
    <div class="spacer"></div>
    <button class="info">Sign up for an information session</button>
  </div>`);
  band.querySelector('.info').onclick = () => state.openInfoQR();
  return band;
}

function ceCourseByCode(code) {
  return data.ce.categories.flatMap((cat) => cat.courses).find((c) => c.code === code);
}

function ceView() {
  const ce = data.ce;
  const cols = ce.categories.map((cat) => `
    <div class="term"><div class="th"><b>${esc(cat.name)}</b><span>${cat.courses.length}</span></div>
      <div class="rows">${cat.courses.map((c) => `<button class="row ce-row" data-code="${esc(c.code)}"><div class="code">${esc(c.code)}</div><div class="nm">${esc(c.name)}</div>${c.price ? `<div class="ce-meta">$${c.price}${c.hours ? ` &middot; ${c.hours} hrs` : ''}</div>` : `<div class="ce-meta tba">Dates coming soon</div>`}</button>`).join('')}</div></div>`).join('');
  const s = el(`
    <section class="screen detail ce">
      <div class="spine" style="background:${ce.color}"></div>
      <div class="hdr"><img src="assets/logo-white.png" alt="Central Piedmont">
        <div class="crumbs"><b>${esc(ce.short)}</b></div>
        <div class="hdr-actions"><button class="backbtn">Back</button><button class="restart">Start over</button></div></div>
      <div class="titlebar"><span class="fam" style="background:${ce.color};color:${ce.text}">${esc(ce.short)}</span>
        <h2>IT Certifications &amp; Short Courses</h2><div class="tap-hint">Tap any course for details</div></div>
      <div class="ce-tagline">${esc(ce.tagline)}</div>
      <div class="terms">${cols}</div>
    </section>`);
  s.querySelector('.restart').onclick = () => state.startOver();
  s.querySelector('.backbtn').onclick = () => state.goBack();
  s.querySelector('.terms').addEventListener('click', (e) => {
    const row = e.target.closest('.ce-row');
    if (row) state.showCECourse(ceCourseByCode(row.dataset.code));
  });
  s.appendChild(ceFooter(data.ce.qrFile, 'Scan to browse dates, pricing &amp; register'));
  return s;
}

function ceCourseView(c) {
  const ce = data.ce;
  if (!c) return ceView();
  const desc = c.desc || 'Hands-on, certificate-focused training. Scan the code to view the full course description, upcoming dates, and pricing.';
  const s = el(`
    <section class="screen detail ce">
      <div class="spine" style="background:${ce.color}"></div>
      <div class="hdr"><img src="assets/logo-white.png" alt="Central Piedmont">
        <div class="crumbs"><b>${esc(ce.short)} · ${esc(c.code)}</b></div>
        <div class="hdr-actions"><button class="backbtn">Back</button><button class="restart">Start over</button></div></div>
      <div class="body">
        <div class="left">
          <div class="photo" style="background-image:url(${ce.photo})"></div><div class="scrim"></div>
          <div class="meta">
            <span class="fam" style="background:${ce.color};color:${ce.text}">${esc(ce.short)}</span>
            <h2>${esc(c.name)}</h2>
            <div class="facts">
              <div><b>${c.price ? '$' + c.price : 'TBA'}</b><small>Course fee</small></div>
              <div><b>${c.hours || 'TBA'}</b><small>Contact hours</small></div>
              <div><b>${esc(c.code)}</b><small>Course code</small></div>
            </div>
          </div>
        </div>
        <div class="right">
          <div class="eyebrow">About this course</div>
          <p class="lead">${esc(desc)}</p>
          <hr class="hr"><h3>Good to know</h3>
          <p class="learn">Non-credit continuing education · in person or live online · financial aid options available. Scan the code to see upcoming dates and register.</p>
        </div>
      </div>
    </section>`);
  s.querySelector('.restart').onclick = () => state.startOver();
  s.querySelector('.backbtn').onclick = () => state.goBack();
  s.appendChild(ceFooter(c.qrFile || ce.qrFile, c.qrFile ? 'Scan to register for this course' : 'Scan to browse dates, pricing &amp; register'));
  return s;
}

function quizIntroView() {
  const q = data.quiz;
  const s = el(`
    <section class="screen quiz">
      <div class="hdr"><img src="assets/logo-white.png" alt="Central Piedmont">
        <div class="crumbs"><b>Career Quiz</b></div>
        <button class="restart">Start over</button></div>
      <div class="quiz-intro">
        <div class="qi-icon">${icon(q.intro.icon)}</div>
        <h1>${esc(q.intro.title)}</h1>
        <p>${esc(q.intro.blurb)}</p>
        <div class="qi-actions">
          <button class="backbtn">Back</button>
          <button class="qi-start">Start</button>
        </div>
      </div>
    </section>`);
  s.querySelector('.restart').onclick = () => state.startOver();
  s.querySelector('.backbtn').onclick = () => state.goBack();
  s.querySelector('.qi-start').onclick = () => state.beginQuiz();
  return s;
}

function quizQuestionView() {
  const q = data.quiz;
  const idx = state.quizIndex;
  const question = q.questions[idx];
  const dots = q.questions.map((_, i) => `<span class="dot${i <= idx ? ' on' : ''}"></span>`).join('');
  const tiles = question.answers.map((a, i) => `
    <button class="qtile" data-world="${esc(a.world)}" style="--d:${0.05 + i * 0.08}s">
      <span class="qt-ic">${icon(a.icon)}</span><span class="qt-label">${esc(a.label)}</span>
    </button>`).join('');
  const s = el(`
    <section class="screen quiz quizq">
      <div class="qprog">${dots}</div>
      <div class="qbar"><button class="backbtn">Back</button><h2 class="qprompt">${esc(question.prompt)}</h2><span class="bar-pad"></span></div>
      <div class="qtiles">${tiles}</div>
    </section>`);
  s.querySelector('.backbtn').onclick = () => state.quizBack();
  s.querySelector('.qtiles').addEventListener('click', (e) => {
    const t = e.target.closest('.qtile');
    if (!t) return;
    t.classList.add('sel');
    setTimeout(() => state.answerQuiz(t.dataset.world), 430);
  });
  return s;
}

function quizSuspenseView() {
  const s = el(`<section class="screen quiz quizs"><div class="susp"><div class="ring"></div><div class="st">Reading your results…</div></div></section>`);
  setTimeout(() => { if (state.screen === 'quizSuspense') state.showResult(); }, 1300);
  return s;
}
function quizResultView() {
  const world = data.worlds.find((w) => w.id === state.quizResultWorld);
  const arch = data.quiz.archetypes[state.quizResultWorld];
  const s = el(`
    <section class="screen quiz quizr" style="--wc:${world.color};--wcd:${darken(world.color, 0.5)};--wt:${world.text}">
      <div class="reveal">
        <div class="r-eyebrow">YOUR IT HERO</div>
        <div class="r-badge">${icon(arch.icon)}</div>
        <h1 class="r-name">${esc(arch.name)}</h1>
        <p class="r-blurb">${esc(arch.blurb)}</p>
        <div class="r-actions">
          <button class="r-go">See your matches &rarr;</button>
          <button class="r-email">Email my results</button>
          <button class="r-retake">Retake quiz</button>
        </div>
      </div>
    </section>`);
  s.querySelector('.r-go').onclick = () => state.chooseWorld(state.quizResultWorld);
  s.querySelector('.r-email').onclick = () => state.openEmailResults();
  s.querySelector('.r-retake').onclick = () => state.retakeQuiz();
  setTimeout(() => confetti(s), 450);
  return s;
}

function convertBand(p) {
  const band = el(`<div class="foot">
    <div class="qr" style="background-image:url(${p.qrFile})"></div>
    <div class="qtxt"><b>Scan to take the full degree sheet</b><span>Opens on your phone — no wifi needed</span></div>
    <div class="spacer"></div>
    <button class="info">Sign up for an information session</button>
    <button class="email">Email this</button>
  </div>`);
  band.querySelector('.info').onclick = () => state.openInfoQR();
  band.querySelector('.email').onclick = () => state.openEmail();
  return band;
}

function detailView(p) {
  const color = worldColor(p.world);
  const s = el(`
    <section class="screen detail">
      <div class="spine" style="background:${color}"></div>
      <div class="hdr"><img src="assets/logo-white.png" alt="Central Piedmont">
        <div class="crumbs"><b>${esc(p.name)}${p.track ? ' · ' + esc(p.track) : ''}</b></div>
        <div class="hdr-actions"><button class="backbtn">Back</button><button class="restart">Start over</button></div></div>
      <div class="body">
        <div class="left">
          <div class="photo" style="background-image:url(${p.heroFile})"></div><div class="scrim"></div>
          <div class="meta">
            <span class="fam" style="background:${color};color:${worldText(p.world)}">${esc(data.worlds.find((w)=>w.id===p.world).name)}</span>
            <h2>${esc(p.name)}</h2>
            <div class="facts">
              <div><b>${esc(p.degree)}</b><small>Degree</small></div>
              <div><b>${esc(p.totalHours)}</b><small>Credit hours</small></div>
              <div><b>${esc(p.semesters)}</b><small>Semesters</small></div>
            </div>
          </div>
        </div>
        <div class="right">
          <div class="eyebrow">Why this program</div>
          <p class="lead">${esc(p.lead)}</p>
          <hr class="hr"><h3>What you'll learn</h3>
          <p class="learn">${esc(p.learn)}</p>
          <button class="seecourses">See all courses</button>
        </div>
      </div>
    </section>`);
  s.querySelector('.restart').onclick = () => state.startOver();
  s.querySelector('.backbtn').onclick = () => state.goBack();
  s.querySelector('.seecourses').onclick = () => state.showCourses();
  s.appendChild(convertBand(p));
  return s;
}

function showCourseInfo(r) {
  const o = el(`<div class="overlay"><div class="modal course-modal">
    <div class="cm-code">${esc(r.code)}</div>
    <h3>${esc(r.name)}</h3>
    <div class="cm-cr">${esc(r.credits)} credit hours</div>
    <p class="cm-desc">${esc(r.desc)}</p>
    <button class="close">Close</button></div></div>`);
  o.querySelector('.close').onclick = () => o.remove();
  o.onclick = (e) => { if (e.target === o) o.remove(); };
  app.appendChild(o);
}

function coursesView(p) {
  const color = worldColor(p.world);
  const row = (r) => r.desc
    ? `<button class="row crow" data-code="${esc(r.code)}"><div class="code">${esc(r.code)}</div><div class="nm">${esc(r.name)}<span class="cr">${esc(r.credits)}</span></div></button>`
    : `<div class="row"><div class="code">${esc(r.code)}</div><div class="nm">${esc(r.name)}<span class="cr">${esc(r.credits)}</span></div></div>`;
  const terms = p.planOfStudy.map((t) => `
    <div class="term"><div class="th"><b>${esc(t.term)}</b><span>${esc(t.termCredits)} cr</span></div>
      <div class="rows">${t.rows.map(row).join('')}</div></div>`).join('');
  const note = p.planOfStudy.find((t) => t.note);
  const s = el(`
    <section class="screen detail courses">
      <div class="spine" style="background:${color}"></div>
      <div class="hdr"><img src="assets/logo-white.png" alt="Central Piedmont">
        <div class="crumbs"><b>${esc(p.name)}</b></div>
        <div class="hdr-actions"><button class="backbtn">Back</button><button class="restart">Start over</button></div></div>
      <div class="titlebar"><span class="fam" style="background:${color};color:${worldText(p.world)}">${esc(data.worlds.find((w)=>w.id===p.world).name)}</span>
        <h2>The courses you'll take</h2><div class="tot">Total: <b>${esc(p.totalHours)}</b> credit hours · ${esc(p.degree)}</div></div>
      <div class="courses-hint">Tap any course for its description</div>
      <div class="terms">${terms}</div>
      ${note ? `<div class="note">${esc(note.term)}: ${esc(note.note)}</div>` : ''}
    </section>`);
  s.querySelector('.backbtn').onclick = () => state.back();
  s.querySelector('.restart').onclick = () => state.startOver();
  s.querySelector('.terms').addEventListener('click', (e) => {
    const btn = e.target.closest('.crow');
    if (!btn) return;
    const r = p.planOfStudy.flatMap((t) => t.rows).find((x) => x.code === btn.dataset.code);
    if (r) showCourseInfo(r);
  });
  s.appendChild(convertBand(p));
  return s;
}

const OVERLAYS = {
  infoQR: () => {
    const o = el(`<div class="overlay"><div class="modal">
      <h3>Sign up for an information session</h3>
      <img class="bigqr" src="${data.infoSession.qrFile}" alt="Info session QR">
      <p>Scan with your phone to register.</p>
      <button class="close">Close</button></div></div>`);
    o.querySelector('.close').onclick = () => state.closeOverlay();
    o.onclick = (e) => { if (e.target === o) state.closeOverlay(); };
    return o;
  },
  emailPicker: () => {
    const world = data.worlds.find((w) => w.id === state.quizResultWorld);
    const progs = (world ? world.programIds : []).map((pid) => data.programs[pid]);
    const o = el(`<div class="overlay"><div class="modal email-picker">
      <h3>Which program's info sheet should we send?</h3>
      <div class="ep-list"></div>
      <button class="close">Cancel</button></div></div>`);
    const list = o.querySelector('.ep-list');
    for (const p of progs) {
      const b = el(`<button class="ep-item" style="background:${p.tileColor};color:${p.tileText}"><span>${esc(p.name)}${p.track ? ' · ' + esc(p.track) : ''}</span><span class="ep-arrow"><i class="fa-solid fa-chevron-right"></i></span></button>`);
      b.onclick = () => state.pickEmailProgram(p.id);
      list.appendChild(b);
    }
    o.querySelector('.close').onclick = () => state.closeOverlay();
    o.onclick = (e) => { if (e.target === o) state.closeOverlay(); };
    return o;
  },
  email: () => mountKeyboard({
    initial: state.emailDraft,
    onType: (v) => { if (v !== state.emailDraft) state.typeEmail(v); }, // guard: re-mount fires onType with unchanged value -> avoid render loop
    onCancel: () => state.closeOverlay(),
    onSubmit: async (email) => {
      const ctx = state.emailCtx || { programId: state.current?.id, worldId: null };
      await fetch('/email', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, programId: ctx.programId, worldId: ctx.worldId }) });
      state.closeOverlay();
      flashThanks();
    },
  }),
};

const CONFETTI_COLORS = ['#B4A269', '#005D83', '#ffffff', '#A4262C', '#672666', '#F3C300'];
function confetti(stage) {
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = (50 + (Math.random() * 60 - 30)) + '%';
    c.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    stage.appendChild(c);
    const dx = Math.random() * 260 - 130, dy = 360 + Math.random() * 160, rot = Math.random() * 720 - 360, dur = 1100 + Math.random() * 800;
    c.animate(
      [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg)`, opacity: 0 }],
      { duration: dur, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' },
    );
    setTimeout(() => c.remove(), dur);
  }
}
function flashThanks() {
  const t = el(`<div class="overlay"><div class="modal"><h3>Sent!</h3><p>Check your inbox for the degree sheet.</p></div></div>`);
  app.appendChild(t);
  setTimeout(() => { if (t.isConnected) t.remove(); }, 2500);
}

function bumpIdle() {
  if (!state) return;
  clearTimeout(idleTimer);
  if (state.screen !== 'attract') idleTimer = setTimeout(() => state.reset(), IDLE_MS);
}
['click', 'touchstart', 'keydown'].forEach((ev) => document.addEventListener(ev, bumpIdle, { passive: true }));

// Kiosk lock: no pinch-zoom, double-tap zoom, ctrl-wheel zoom, or ctrl/cmd +/-/0 zoom
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });

(async function boot() {
  data = await (await fetch('kiosk-data.json')).json();
  state = new KioskState(data, { onChange: () => { render(); bumpIdle(); } });
  render();
  fitWithRetries();
  app.addEventListener('click', (e) => {
    if (e.target.id === 'start') state.start();
    else if (e.target.id === 'startquiz') state.startQuiz();
  });
})();
