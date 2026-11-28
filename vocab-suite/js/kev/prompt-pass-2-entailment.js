/**
 * Kev Prompt Pass 2 of 3 — MNLI-Style Concept Entailment (`choice`)
 *
 * Supports single or multiple `-`-separated valid stored answers.
 */

import { normalizeWhitespace } from './text-escape.js';
import { formatExpectedAnswersForPrompt } from './prompt-pass-1-semantic.js';

export function buildPass2Entailment({
  direction,
  promptText,
  expectedAnswer,
  expectedAnswers,
  userAnswer,
}) {
  const targetType = direction === 'def_to_term' ? 'accepted term(s)' : 'definition';
  const formattedExpected = formatExpectedAnswersForPrompt(expectedAnswer, expectedAnswers);

  const state = [
    `Reference Ground-Truth (${targetType}): ${formattedExpected}`,
    `Prompt Context: "${normalizeWhitespace(promptText)}"`,
    `Candidate Student Answer: "${normalizeWhitespace(userAnswer)}"`,
  ].join('\n');

  const instructions =
    'Compare the Candidate Student Answer against the Reference Ground-Truth. Which classification applies?';

  const options = [
    'mismatch: Wrong concept, contradicts the reference, off-topic, or only copies the prompt context',
    'entailed_match: Matches any accepted reference answer, valid synonym, or accurate paraphrase',
  ];

  return {
    passNumber: 2,
    passId: 'concept_entailment',
    passLabel: 'Pass 2 · Concept Entailment',
    state,
    instructions,
    options,
    positiveIndex: 1,
  };
}
