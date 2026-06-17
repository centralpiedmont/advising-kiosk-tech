import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KioskState } from '../public/state.js';

const DATA = {
  worlds: [{ id: 'cyber', programIds: ['cybersecurity-blueteam', 'cloud-networking'] }],
  programs: {
    'cybersecurity-blueteam': { id: 'cybersecurity-blueteam', world: 'cyber' },
    'cloud-networking': { id: 'cloud-networking', world: 'cyber' },
  },
};

test('starts on attract', () => {
  const s = new KioskState(DATA);
  assert.equal(s.screen, 'attract');
});

test('touch → world, pick world → program, pick program → detail', () => {
  const s = new KioskState(DATA);
  s.start();                       assert.equal(s.screen, 'world');
  s.chooseWorld('cyber');          assert.equal(s.screen, 'program');
  assert.deepEqual(s.currentPrograms().map((p) => p.id), ['cybersecurity-blueteam', 'cloud-networking']);
  s.chooseProgram('cloud-networking'); assert.equal(s.screen, 'detail');
  assert.equal(s.current.id, 'cloud-networking');
});

test('detail → courses → back to detail', () => {
  const s = new KioskState(DATA);
  s.start(); s.chooseWorld('cyber'); s.chooseProgram('cloud-networking');
  s.showCourses();   assert.equal(s.screen, 'courses');
  s.back();          assert.equal(s.screen, 'detail');
});

test('email overlay open/close; idle resets to attract and clears email', () => {
  const s = new KioskState(DATA);
  s.start(); s.chooseWorld('cyber'); s.chooseProgram('cloud-networking');
  s.openEmail(); assert.equal(s.overlay, 'email');
  s.typeEmail('foo@bar.edu'); assert.equal(s.emailDraft, 'foo@bar.edu');
  s.reset();
  assert.equal(s.screen, 'attract');
  assert.equal(s.overlay, null);
  assert.equal(s.emailDraft, '');
  assert.equal(s.current, null);
});

test('startOver from any screen returns to attract', () => {
  const s = new KioskState(DATA);
  s.start(); s.chooseWorld('cyber'); s.chooseProgram('cloud-networking'); s.showCourses();
  s.startOver();
  assert.equal(s.screen, 'attract');
});

test('single-program world auto-skips to detail', () => {
  const singleData = {
    worlds: [{ id: 'start', programIds: ['it-technical-support'] }],
    programs: { 'it-technical-support': { id: 'it-technical-support', world: 'start' } },
  };
  const s = new KioskState(singleData);
  s.start();
  s.chooseWorld('start');
  assert.equal(s.screen, 'detail');
  assert.equal(s.current.id, 'it-technical-support');
});

test('goBack walks the navigation stack: detail -> program -> world -> attract', () => {
  const s = new KioskState(DATA);
  s.start(); s.chooseWorld('cyber'); s.chooseProgram('cloud-networking');
  assert.equal(s.screen, 'detail');
  s.goBack(); assert.equal(s.screen, 'program');
  s.goBack(); assert.equal(s.screen, 'world');
  s.goBack(); assert.equal(s.screen, 'attract');
});

test('CE course detail navigation: showCE -> showCECourse -> goBack -> ce', () => {
  const data = { worlds: [], programs: {}, ce: { categories: [] } };
  const s = new KioskState(data);
  s.start(); s.showCE();
  assert.equal(s.screen, 'ce');
  s.showCECourse({ code: 'X', name: 'Test' });
  assert.equal(s.screen, 'ce-detail');
  assert.equal(s.ceCourse.code, 'X');
  s.goBack(); assert.equal(s.screen, 'ce');
  s.goBack(); assert.equal(s.screen, 'world');
});

const QUIZ_DATA = {
  worlds: [], programs: {},
  quiz: {
    tieOrder: ['cyber', 'apps', 'data', 'games', 'start'],
    archetypes: { cyber: { name: 'The Defender' }, apps: {}, data: {}, games: {}, start: {} },
    questions: [
      { answers: [{ world: 'cyber' }] }, { answers: [{ world: 'cyber' }] },
      { answers: [{ world: 'apps' }] }, { answers: [{ world: 'cyber' }] },
      { answers: [{ world: 'data' }] }, { answers: [{ world: 'cyber' }] },
    ],
  },
};

test('quiz: home -> intro -> first question', () => {
  const s = new KioskState(QUIZ_DATA);
  s.startQuiz(); assert.equal(s.screen, 'quizIntro');
  s.beginQuiz(); assert.equal(s.screen, 'quizQuestion'); assert.equal(s.quizIndex, 0);
});

test('quiz: answering advances; the last answer goes to suspense then result world', () => {
  const s = new KioskState(QUIZ_DATA);
  s.startQuiz(); s.beginQuiz();
  ['cyber', 'cyber', 'apps', 'cyber', 'data'].forEach((w) => s.answerQuiz(w));
  assert.equal(s.quizIndex, 5);
  assert.equal(s.screen, 'quizQuestion');
  s.answerQuiz('cyber');
  assert.equal(s.screen, 'quizSuspense');
  assert.equal(s.quizResultWorld, 'cyber');
  s.showResult(); assert.equal(s.screen, 'quizResult');
});

test('quiz: quizBack steps back a question, then to intro from Q1', () => {
  const s = new KioskState(QUIZ_DATA);
  s.startQuiz(); s.beginQuiz();
  s.answerQuiz('cyber'); assert.equal(s.quizIndex, 1);
  s.quizBack(); assert.equal(s.quizIndex, 0); assert.equal(s.screen, 'quizQuestion');
  s.quizBack(); assert.equal(s.screen, 'quizIntro');
});

test('quiz: result Back returns to attract; reset clears quiz state', () => {
  const s = new KioskState(QUIZ_DATA);
  s.startQuiz(); s.beginQuiz();
  ['cyber', 'cyber', 'apps', 'cyber', 'data', 'cyber'].forEach((w) => s.answerQuiz(w));
  s.showResult();
  s.goBack(); assert.equal(s.screen, 'attract');
  s.startQuiz(); s.reset();
  assert.equal(s.quizIndex, 0); assert.deepEqual(s.quizAnswers, []); assert.equal(s.quizResultWorld, null);
});

const EMAIL_DATA = {
  worlds: [{ id: 'cyber', programIds: ['cybersecurity-blueteam', 'cloud-networking'] }],
  programs: { 'cybersecurity-blueteam': { id: 'cybersecurity-blueteam', world: 'cyber' }, 'cloud-networking': { id: 'cloud-networking', world: 'cyber' } },
};

test('openEmail (program path) sets emailCtx with worldId null', () => {
  const s = new KioskState(EMAIL_DATA);
  s.start(); s.chooseWorld('cyber'); s.chooseProgram('cloud-networking');
  s.openEmail();
  assert.equal(s.overlay, 'email');
  assert.deepEqual(s.emailCtx, { programId: 'cloud-networking', worldId: null });
});

test('quiz result email: openEmailResults -> pickEmailProgram sets emailCtx + opens keyboard', () => {
  const s = new KioskState(EMAIL_DATA);
  s.quizResultWorld = 'cyber';
  s.openEmailResults();
  assert.equal(s.overlay, 'emailPicker');
  s.pickEmailProgram('cybersecurity-blueteam');
  assert.equal(s.overlay, 'email');
  assert.deepEqual(s.emailCtx, { programId: 'cybersecurity-blueteam', worldId: 'cyber' });
});

test('reset clears emailCtx', () => {
  const s = new KioskState(EMAIL_DATA);
  s.start(); s.chooseWorld('cyber'); s.chooseProgram('cloud-networking'); s.openEmail();
  s.reset();
  assert.equal(s.emailCtx, null);
});
