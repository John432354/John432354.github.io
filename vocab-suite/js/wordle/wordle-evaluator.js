/**
 * Vocab Wordle Evaluator & Dynamic Answer-Length Cooldown Calculator
 *
 * - Pure deterministic letter-by-letter Wordle evaluation (NO AI correction).
 * - Preserves visual word gaps for multi-word vocab terms (e.g., "AD HOMINEM")
 *   while letting players type pure letters/digits (`A-Z`, `0-9`).
 * - Calculates skip study cooldown dynamically from answer + explanation length.
 */

export function prepareWordleTarget(rawTerm) {
  const display = String(rawTerm ?? '').trim();
  const letters = [];
  const spaceBeforeIndices = new Set();
  let pendingSeparator = false;

  for (const ch of display) {
    if (/[A-Za-z0-9]/.test(ch)) {
      if (pendingSeparator && letters.length > 0) {
        spaceBeforeIndices.add(letters.length);
      }
      letters.push(ch.toUpperCase());
      pendingSeparator = false;
    } else if (/\s|[-_/]/.test(ch)) {
      pendingSeparator = true;
    }
  }

  return {
    display,
    letters,
    length: letters.length,
    spaceBeforeIndices,
  };
}

/**
 * Standard 2-pass Wordle evaluation (`correct`, `present`, `absent`).
 */
export function evaluateWordleGuess(guessChars, targetChars) {
  const len = targetChars.length;
  const states = new Array(len).fill('absent');
  const remainingCounts = new Map();

  // Pass 1: Exact position matches (`correct`)
  for (let i = 0; i < len; i += 1) {
    const g = guessChars[i];
    const t = targetChars[i];
    if (g === t) {
      states[i] = 'correct';
    } else {
      remainingCounts.set(t, (remainingCounts.get(t) || 0) + 1);
    }
  }

  // Pass 2: Misplaced letters (`present` vs `absent`)
  for (let i = 0; i < len; i += 1) {
    if (states[i] === 'correct') continue;
    const g = guessChars[i];
    const count = remainingCounts.get(g) || 0;
    if (count > 0) {
      states[i] = 'present';
      remainingCounts.set(g, count - 1);
    }
  }

  const isSolved = states.every((s) => s === 'correct');
  return { states, isSolved };
}

const KEY_PRIORITY = { absent: 1, present: 2, correct: 3 };

export function buildKeyboardLetterMap(guesses = []) {
  const map = {};
  for (const g of guesses) {
    g.letters.forEach((ch, idx) => {
      const nextState = g.states[idx];
      const prevState = map[ch];
      if (!prevState || KEY_PRIORITY[nextState] > KEY_PRIORITY[prevState]) {
        map[ch] = nextState;
      }
    });
  }
  return map;
}

/**
 * Dynamic Skip Cooldown Formula:
 * Scales how long the revealed answer stays locked on screen based on the
 * length of the valid answer(s) and optional explanation.
 */
export function computeDynamicSkipCooldownMs(card) {
  const answersStr = Array.isArray(card?.terms)
    ? card.terms.join(' - ')
    : String(card?.term || '');
  const explanationStr = String(card?.explanation || '');

  // Base 2.2s + 140ms per answer character + 38ms per explanation character
  const rawMs = 2200 + answersStr.length * 140 + explanationStr.length * 38;
  return Math.max(2500, Math.min(25000, Math.round(rawMs)));
}
