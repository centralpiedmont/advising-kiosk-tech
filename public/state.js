import { scoreQuiz } from './quiz-score.js';

export class KioskState {
  constructor(data, { onChange } = {}) {
    this.data = data;
    this.onChange = onChange || (() => {});
    this.reset();
  }
  _emit() { this.onChange(this); }
  _snap() { return { screen: this.screen, worldId: this.worldId, current: this.current, ceCourse: this.ceCourse }; }
  _push() { this.history.push(this._snap()); }
  reset() {
    this.screen = 'attract';
    this.overlay = null;
    this.worldId = null;
    this.current = null;
    this.ceCourse = null;
    this.emailDraft = '';
    this.history = [];
    this.quizIndex = 0;
    this.quizAnswers = [];
    this.quizResultWorld = null;
    this.emailCtx = null;
    this._emit();
  }
  startOver() { this.reset(); }
  // Pop the navigation stack to the previous screen (restoring its context).
  goBack() {
    const prev = this.history.pop();
    if (!prev) { this.reset(); return; }
    this.screen = prev.screen;
    this.worldId = prev.worldId;
    this.current = prev.current;
    this.ceCourse = prev.ceCourse;
    this.overlay = null;
    this._emit();
  }
  back() { this.goBack(); } // alias

  start() { this._push(); this.screen = 'world'; this.overlay = null; this._emit(); }
  chooseWorld(id) {
    this._push();
    this.worldId = id;
    const world = this.data.worlds.find((w) => w.id === id);
    if (world && world.programIds.length === 1) {
      this.current = this.data.programs[world.programIds[0]]; // single-program world skips the list
      this.screen = 'detail';
    } else {
      this.screen = 'program';
    }
    this._emit();
  }
  currentPrograms() {
    const world = this.data.worlds.find((w) => w.id === this.worldId);
    return (world ? world.programIds : []).map((pid) => this.data.programs[pid]);
  }
  chooseProgram(id) { this._push(); this.current = this.data.programs[id]; this.screen = 'detail'; this._emit(); }
  showCourses() { this._push(); this.screen = 'courses'; this._emit(); }
  showCE() { this._push(); this.worldId = null; this.current = null; this.screen = 'ce'; this.overlay = null; this._emit(); }
  showCECourse(course) { this._push(); this.ceCourse = course; this.screen = 'ce-detail'; this.overlay = null; this._emit(); }
  openInfoQR() { this.overlay = 'infoQR'; this._emit(); }
  openEmail() { this.emailCtx = { programId: this.current ? this.current.id : null, worldId: null }; this.overlay = 'email'; this._emit(); }
  openEmailResults() { this.overlay = 'emailPicker'; this._emit(); }
  pickEmailProgram(programId) { this.emailCtx = { programId, worldId: this.quizResultWorld }; this.overlay = 'email'; this._emit(); }
  closeOverlay() { this.overlay = null; this._emit(); }
  typeEmail(v) { this.emailDraft = v; this._emit(); }
  startQuiz() {
    this._push();
    this.quizIndex = 0; this.quizAnswers = []; this.quizResultWorld = null;
    this.screen = 'quizIntro'; this.overlay = null; this._emit();
  }
  beginQuiz() { this.quizIndex = 0; this.quizAnswers = []; this.screen = 'quizQuestion'; this._emit(); }
  answerQuiz(world) {
    this.quizAnswers[this.quizIndex] = world;
    const last = this.data.quiz.questions.length - 1;
    if (this.quizIndex < last) {
      this.quizIndex++;
    } else {
      this.quizResultWorld = scoreQuiz(this.quizAnswers, this.data.quiz.tieOrder);
      this.screen = 'quizSuspense';
    }
    this._emit();
  }
  quizBack() {
    if (this.quizIndex > 0) { this.quizIndex--; this.screen = 'quizQuestion'; }
    else { this.screen = 'quizIntro'; }
    this._emit();
  }
  showResult() { this.screen = 'quizResult'; this._emit(); }
  retakeQuiz() { this.beginQuiz(); }
}
