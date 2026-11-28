/**
 * Core Game & AI Configuration Constants
 */

export const GAME_DEFAULTS = {
  roundsPerDive: 7,
  roundDurationSec: 25,
  metersPerPoint: 10,
  maxPointsPerRound: 100,
  promptDirection: 'term_to_def', // 'term_to_def' | 'def_to_term' | 'mixed'
  scoringMode: 'interpolated',    // 'interpolated' (exact speed meters) | 'banded' (classic 6 fixed tiers)
  companion: 'krill',             // 'krill' | 'submersible'
  companionId: 'krill',
  kevThreshold: 0.52,             // Averaged 3-pass calibrated probability cutoff
  soundEnabled: true,
};

export const COMPANION_SPECIES = [
  { id: 'krill', emoji: '🦐', name: 'Bioluminescent Krill' },
  { id: 'submersible', emoji: '🚤', name: 'Research Submersible' },
];

export const PROMPT_DIRECTIONS = [
  {
    id: 'term_to_def',
    label: 'Term → Definition',
    shortLabel: 'Write Definition',
    description: 'Prompt shows the stored Term; you write the Definition.',
  },
  {
    id: 'def_to_term',
    label: 'Definition → Term',
    shortLabel: 'Write Term',
    description: 'Prompt shows the stored Definition; you name the Term.',
  },
  {
    id: 'mixed',
    label: 'Mixed Dive',
    shortLabel: 'Mixed',
    description: 'Randomly alternates Term → Definition and Definition → Term each round.',
  },
];

export const ROUND_DURATION_OPTIONS = [15, 25, 35];
export const ROUNDS_COUNT_OPTIONS = [5, 7, 10];
