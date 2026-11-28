/**
 * Krillion Speed-to-Depth Tiers
 *
 * Replaces crowd-rarity scoring with answer-speed scoring:
 * Faster valid answers earn higher points and deeper dives (up to 1,000m per round).
 * Thresholds are defined as `maxElapsedRatio` (elapsedTime / roundDuration),
 * so they scale cleanly whether the round timer is 15s, 25s, or 40s.
 */

export const SPEED_TIERS = [
  {
    id: 'one_in_a_krillion',
    name: 'One in a Krillion',
    maxElapsedRatio: 0.18, // <= 4.5s on a 25s timer
    points: 100,
    meters: 1000,
    color: '#ffe066',
    glow: 'rgba(255, 224, 102, 0.45)',
    tagline: 'Instantaneous recall — maximum trench descent!',
    stars: 8,
  },
  {
    id: 'deep_cut',
    name: 'Deep Cut',
    maxElapsedRatio: 0.34, // <= 8.5s on a 25s timer
    points: 85,
    meters: 850,
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.4)',
    tagline: 'Blistering deep-sea reflex.',
    stars: 5,
  },
  {
    id: 'rare',
    name: 'Rare',
    maxElapsedRatio: 0.52, // <= 13.0s on a 25s timer
    points: 60,
    meters: 600,
    color: '#38f2ff',
    glow: 'rgba(56, 242, 255, 0.35)',
    tagline: 'Swift and decisive dive.',
    stars: 3,
  },
  {
    id: 'schooler',
    name: 'Schooler',
    maxElapsedRatio: 0.70, // <= 17.5s on a 25s timer
    points: 30,
    meters: 300,
    color: '#34f5a6',
    glow: 'rgba(52, 245, 166, 0.3)',
    tagline: 'Steady mid-water cruise.',
    stars: 1,
  },
  {
    id: 'too_clever',
    name: 'Too Clever',
    maxElapsedRatio: 0.86, // <= 21.5s on a 25s timer
    points: 15,
    meters: 150,
    color: '#60a5fa',
    glow: 'rgba(96, 165, 250, 0.25)',
    tagline: 'Thought it over before taking the plunge.',
    stars: 0,
  },
  {
    id: 'plankton',
    name: 'Plankton',
    maxElapsedRatio: 1.0, // <= 25.0s on a 25s timer
    points: 10,
    meters: 100,
    color: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.2)',
    tagline: 'Beat the buzzer at the surface.',
    stars: 0,
  },
];

export const ZERO_TIER = {
  id: 'no_echo',
  name: 'No Echo',
  maxElapsedRatio: Infinity,
  points: 0,
  meters: 0,
  color: '#ff5d73',
  glow: 'rgba(255, 93, 115, 0.3)',
  tagline: 'No depth gained on this round.',
  stars: 0,
};
