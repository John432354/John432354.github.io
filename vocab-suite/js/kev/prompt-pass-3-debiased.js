/**
 * Kev Prompt Pass 3 of 3 — Position-Debiased Rubric Check (`choice`, Reversed Order)
 *
 * Supports single or multiple `-`-separated valid stored answers.
 */

import { normalizeWhitespace } from './text-escape.js';
import { formatExpectedAnswersForPrompt } from './prompt-pass-1-semantic.js';

export function buildPass3Debiased({
  direction,
  promptText,
  expectedAnswer,
  expectedAnswers,
  userAnswer,
}) {
  const isMulti = Array.isArray(expectedAnswers) && expectedAnswers.length > 1;
  const formattedExpected = formatExpectedAnswersForPrompt(expectedAnswer, expectedAnswers);
  const modeDesc =
    direction === 'def_to_term'
      ? `Player was shown the definition and asked for ${
          isMulti ? 'any one of the accepted terms' : 'the matching term'
        }.`
      : 'Player was shown the term and asked to write its definition.';

  const state = [
    `Grading Policy: ${modeDesc} Credit ACCEPT when the player's answer matches ${
      isMulti ? 'any one of the Stored Accepted Answers' : 'the Stored Answer'
    } (minor typos, articles, synonyms, or clear paraphrasing allowed). Credit REJECT when the player's answer is wrong, incomplete, unrelated, or repeats the prompt.`,
    `Prompt Shown: "${normalizeWhitespace(promptText)}"`,
    `Stored Accepted Answer(s): ${formattedExpected}`,
    `Player Answer: "${normalizeWhitespace(userAnswer)}"`,
  ].join('\n');

  const instructions = 'Under the Grading Policy, how should the Player Answer be graded?';

  const options = [
    'ACCEPT: Valid answer that matches or accurately paraphrases an accepted stored answer',
    'REJECT: Invalid answer that misses, contradicts, or fails to state an accepted stored answer',
  ];

  return {
    passNumber: 3,
    passId: 'debiased_rubric',
    passLabel: 'Pass 3 · Debiased Rubric',
    state,
    instructions,
    options,
    positiveIndex: 0,
  };
}
