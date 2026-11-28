/**
 * Random Krillion Dive Generator
 *
 * Randomly samples stored cards (with Unit, Topic, `-`-separated valid answers,
 * and optional Java-comment Explanation) from selected subjects/topics.
 */

export function fisherYatesShuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateRandomKrillion({
  subjects,
  roundsCount = 7,
  promptDirection = 'term_to_def',
  roundDurationSec = 25,
}) {
  const pool = [];
  for (const subj of subjects || []) {
    for (const card of subj.cards || []) {
      const terms =
        Array.isArray(card.terms) && card.terms.length > 0
          ? card.terms
          : [card.term].filter(Boolean);
      if (terms.length === 0 || !card.definition) continue;

      pool.push({
        cardId: card.id,
        terms,
        term: terms.join(' - '),
        definition: card.definition,
        explanation: card.explanation || '',
        unit: card.unit || '',
        topic: card.topic || 'General',
        subjectId: subj.id,
        subjectName: subj.name,
        subjectIcon: subj.icon,
        subjectAccent: subj.accent,
      });
    }
  }

  if (pool.length === 0) {
    throw new Error('Selected subjects/topics contain no stored terms & definitions.');
  }

  const picked = [];
  let bag = fisherYatesShuffle(pool);

  while (picked.length < roundsCount) {
    if (bag.length === 0) {
      bag = fisherYatesShuffle(pool);
      if (
        pool.length > 1 &&
        picked.length > 0 &&
        bag[0].cardId === picked[picked.length - 1].cardId
      ) {
        bag.push(bag.shift());
      }
    }
    picked.push(bag.shift());
  }

  const rounds = picked.map((entry, idx) => {
    const dir =
      promptDirection === 'mixed'
        ? Math.random() < 0.5
          ? 'term_to_def'
          : 'def_to_term'
        : promptDirection;

    const isDefToTerm = dir === 'def_to_term';
    const expectedAnswers = isDefToTerm ? entry.terms : [entry.definition];
    const expectedAnswerDisplay = isDefToTerm
      ? entry.terms.join(' - ')
      : entry.definition;

    return {
      roundNumber: idx + 1,
      totalRounds: roundsCount,
      durationSec: roundDurationSec,
      direction: dir,
      subjectId: entry.subjectId,
      subjectName: entry.subjectName,
      subjectIcon: entry.subjectIcon,
      subjectAccent: entry.subjectAccent,
      unit: entry.unit,
      topic: entry.topic,
      terms: entry.terms,
      term: entry.term,
      definition: entry.definition,
      explanation: entry.explanation,
      promptLabel: isDefToTerm
        ? `STORED DEFINITION · NAME ${entry.terms.length > 1 ? 'ANY VALID TERM' : 'THE TERM'}`
        : 'STORED TERM · WRITE THE DEFINITION',
      promptText: isDefToTerm ? entry.definition : entry.terms.join(' / '),
      expectedAnswer: expectedAnswerDisplay,
      expectedAnswers,
      inputPlaceholder: isDefToTerm
        ? entry.terms.length > 1
          ? `Type any 1 of the ${entry.terms.length} valid terms and press Enter…`
          : 'Type the matching term and press Enter…'
        : 'Type the definition in your own words and press Enter…',
    };
  });

  return {
    diveId: `dive_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    subjectIds: subjects.map((s) => s.id),
    subjectNames: subjects.map((s) => s.name),
    roundsCount,
    roundDurationSec,
    promptDirection,
    rounds,
  };
}
