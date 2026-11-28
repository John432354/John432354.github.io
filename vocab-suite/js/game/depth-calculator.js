/**
 * Time-to-Answer Depth & Krillion Tier Calculator
 *
 * Maps answer speed (`elapsedMs` / `durationMs`) to ocean depth in meters
 * (`0m` -> `1,000m` per round; `7,000m` max across a 7-round Krillion dive).
 */

import { SPEED_TIERS, ZERO_TIER } from '../config/speed-tiers.js';

export function computeDepthFromTime({
  isValid,
  elapsedMs,
  durationMs,
  scoringMode = 'interpolated',
}) {
  if (!isValid) {
    return {
      points: 0,
      depthMeters: 0,
      elapsedRatio: Math.min(1, Math.max(0, elapsedMs / Math.max(1, durationMs))),
      tier: ZERO_TIER,
    };
  }

  const ratio = Math.min(1, Math.max(0, elapsedMs / Math.max(1, durationMs)));
  const matchedTier =
    SPEED_TIERS.find((t) => ratio <= t.maxElapsedRatio) ||
    SPEED_TIERS[SPEED_TIERS.length - 1];

  if (scoringMode === 'banded') {
    return {
      points: matchedTier.points,
      depthMeters: matchedTier.meters,
      elapsedRatio: ratio,
      tier: matchedTier,
    };
  }

  // Smooth continuous speed curve:
  // Answering within top 10% of round timer (e.g. <= 2.5s on 25s) earns full 1,000m (100 pts).
  // Scales smoothly down to 100m (10 pts) right at the buzzer.
  let depthMeters;
  if (ratio <= 0.10) {
    depthMeters = 1000;
  } else {
    const normalizedRemaining = (1 - ratio) / 0.90; // 1.0 -> 0.0
    depthMeters = Math.round(100 + 900 * Math.pow(normalizedRemaining, 1.12));
  }

  depthMeters = Math.max(100, Math.min(1000, depthMeters));
  const points = Math.round(depthMeters / 10);

  return {
    points,
    depthMeters,
    elapsedRatio: ratio,
    tier: matchedTier,
  };
}

export function previewPotentialDepth(elapsedMs, durationMs, scoringMode = 'interpolated') {
  return computeDepthFromTime({
    isValid: true,
    elapsedMs,
    durationMs,
    scoringMode,
  });
}
