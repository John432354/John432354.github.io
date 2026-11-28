/**
 * Player Krillion Dive Telemetry & Vocab Wordle Records
 */

import { STORAGE_KEYS } from './storage-keys.js';

const DEFAULT_STATS = {
  divesCompleted: 0,
  bestDepthMeters: 0,
  totalDepthMeters: 0,
  totalRoundsAnswered: 0,
  totalRoundsValid: 0,
  fastestValidMs: null,
  subjectBestDepths: {},
  history: [],
};

const DEFAULT_WORDLE_STATS = {
  solved: 0,
  skipped: 0,
  streak: 0,
  bestStreak: 0,
};

export class StatsRepository {
  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STATS);
      this.stats = raw ? { ...DEFAULT_STATS, ...JSON.parse(raw) } : { ...DEFAULT_STATS };
    } catch {
      this.stats = { ...DEFAULT_STATS };
    }

    try {
      const wRaw = localStorage.getItem(STORAGE_KEYS.WORDLE_STATS);
      this.wordleStats = wRaw
        ? { ...DEFAULT_WORDLE_STATS, ...JSON.parse(wRaw) }
        : { ...DEFAULT_WORDLE_STATS };
    } catch {
      this.wordleStats = { ...DEFAULT_WORDLE_STATS };
    }
  }

  getStats() {
    return {
      ...this.stats,
      deepestDiveMeters: this.stats.bestDepthMeters,
      totalDives: this.stats.divesCompleted,
    };
  }

  getWordleStats() {
    return { ...this.wordleStats };
  }

  saveWordleStats(nextWordleStats) {
    this.wordleStats = { ...DEFAULT_WORDLE_STATS, ...nextWordleStats };
    try {
      localStorage.setItem(STORAGE_KEYS.WORDLE_STATS, JSON.stringify(this.wordleStats));
    } catch {
      // ignore storage quota errors
    }
    return this.getWordleStats();
  }

  recordCompletedDive(summary) {
    const s = this.stats;
    s.divesCompleted += 1;
    s.totalDepthMeters += summary.totalDepthMeters;
    if (summary.totalDepthMeters > s.bestDepthMeters) {
      s.bestDepthMeters = summary.totalDepthMeters;
    }

    for (const r of summary.rounds) {
      s.totalRoundsAnswered += 1;
      if (r.isValid) {
        s.totalRoundsValid += 1;
        if (s.fastestValidMs === null || r.elapsedMs < s.fastestValidMs) {
          s.fastestValidMs = r.elapsedMs;
        }
      }
    }

    if (Array.isArray(summary.subjectIds)) {
      for (const sid of summary.subjectIds) {
        const prev = Number(s.subjectBestDepths[sid] || 0);
        if (summary.totalDepthMeters > prev) {
          s.subjectBestDepths[sid] = summary.totalDepthMeters;
        }
      }
    }

    s.history = [
      {
        id: summary.diveId,
        completedAt: Date.now(),
        totalDepthMeters: summary.totalDepthMeters,
        totalPoints: summary.totalPoints,
        validCount: summary.rounds.filter((r) => r.isValid).length,
        roundCount: summary.rounds.length,
        subjectNames: summary.subjectNames,
      },
      ...(s.history || []),
    ].slice(0, 35);

    this.persist();
    return this.getStats();
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(this.stats));
    } catch {
      // ignore storage quota errors
    }
  }
}
