/**
 * Kev Prompt Pass 1 of 3 — Direct Semantic Equivalence (`noul`: ["no", "yes"])
 *
 * Supports single or multiple `-`-separated valid stored answers.
 */

import { normalizeWhitespace } from './text-escape.js';

export function formatExpectedAnswersForPrompt(expectedAnswer, expectedAnswers) {
  const list =
    Array.isArray(expectedAnswers) && expectedAnswers.length > 0
      ? expectedAnswers.map((a) => normalizeWhitespace(a)).filter(Boolean)
      : [normalizeWhitespace(expectedAnswer)].filter(Boolean);

  if (list.length <= 1) {
    return `"${list[0] || ''}"`;
  }
  return list.map((a) => `"${a}"`).join(' OR ');
}

export function buildPass1Semantic({
  subjectName,
  direction,
  promptText,
  expectedAnswer,
  expectedAnswers,
  userAnswer,
}) {
  const promptRole = direction === 'def_to_term' ? 'Stored Definition' : 'Stored Term';
  const expectedRole =
    direction === 'def_to_term' ? 'Accepted Stored Term(s)' : 'Stored Correct Definition';
  const formattedExpected = formatExpectedAnswersForPrompt(expectedAnswer, expectedAnswers);
  const multiNote =
    Array.isArray(expectedAnswers) && expectedAnswers.length > 1
      ? 'Matching ANY ONE of the Accepted Stored Terms counts as YES. '
      : '';

  const state = [
    `Subject: ${normalizeWhitespace(subjectName || 'General')}`,
    `${promptRole} (Question Shown): "${normalizeWhitespace(promptText)}"`,
    `${expectedRole}: ${formattedExpected}`,
    `Player Submitted Answer: "${normalizeWhitespace(userAnswer)}"`,
    `Criteria: ${multiNote}Answer "yes" if the Player Submitted Answer matches, names, or accurately paraphrases ${expectedRole}. Answer "no" if it refers to a different concept, is inaccurate, is gibberish, or merely repeats the ${promptRole} without answering.`,
  ].join('\n');

  const instructions =
    `Does the Player Submitted Answer accurately match or express the same core meaning as ${expectedRole}?`;

  return {
    passNumber: 1,
    passId: 'semantic_noul',
    passLabel: 'Pass 1 · Semantic Match',
    state,
    instructions,
    options: ['no', 'yes'],
    positiveIndex: 1,
  };
}
