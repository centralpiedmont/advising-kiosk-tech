// Pure quiz scoring. answers = array of chosen world ids (one per question, in order).
// Winner = most-chosen world. Tie-break: the world chosen in the LAST answer (Q6,
// the explicit "what job do you want") wins if it's among the tied; otherwise the
// first world in tieOrder that is tied. Always deterministic. DOM-free.
export function scoreQuiz(answers, tieOrder) {
  const tally = {};
  for (const w of answers) tally[w] = (tally[w] || 0) + 1;
  const max = Math.max(...Object.values(tally));
  const top = Object.keys(tally).filter((w) => tally[w] === max);
  if (top.length === 1) return top[0];
  const last = answers[answers.length - 1];
  if (top.includes(last)) return last;
  for (const w of tieOrder) if (top.includes(w)) return w;
  return top[0];
}
