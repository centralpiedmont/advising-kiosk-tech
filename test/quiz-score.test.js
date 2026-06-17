import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreQuiz } from '../public/quiz-score.js';

const ORDER = ['cyber', 'apps', 'data', 'games', 'start'];

test('clear winner returns the most-chosen world', () => {
  assert.equal(scoreQuiz(['apps', 'apps', 'apps', 'data', 'data', 'cyber'], ORDER), 'apps');
});

test('a tie is broken by the LAST answer (the Q6 job question)', () => {
  // 2-2-2 tie between apps, cyber, games; last answer is games -> games wins
  assert.equal(scoreQuiz(['apps', 'apps', 'cyber', 'cyber', 'games', 'games'], ORDER), 'games');
});

test('tie not containing the last answer falls back to tieOrder', () => {
  // apps2, cyber2 tie; last answer games is not tied -> tieOrder picks cyber (before apps)
  assert.equal(scoreQuiz(['apps', 'apps', 'cyber', 'cyber', 'data', 'games'], ORDER), 'cyber');
});

test('all same answers returns that world', () => {
  assert.equal(scoreQuiz(['games', 'games', 'games', 'games', 'games', 'games'], ORDER), 'games');
});
