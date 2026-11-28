/**
 * Krillion Dive Session Orchestrator
 *
 * Coordinates:
 * - 7-round Dive flow & 3-pass Kev judging (supporting `-` multi-answers)
 * - Always showing the real stored answer(s) + optional Java-comment explanation
 * - "Give Up" button forcing the reader to view the correct answer for the
 *   remaining round time before unlocking the Next Question button!
 */

import { generateRandomKrillion } from './krillion-generator.js';
import { RoundTimer } from './timer-controller.js';
import { computeDepthFromTime } from './depth-calculator.js';

export class DiveSessionEngine {
  constructor({ kevClient, soundFx, onUpdate, onDepthChange }) {
    this.kevClient = kevClient;
    this.soundFx = soundFx;
    this.onUpdate = onUpdate;
    this.onDepthChange = onDepthChange;
    this.timer = new RoundTimer();
    this.studyLockRaf = null;
    this.session = null;
  }

  getSession() {
    return this.session;
  }

  stopStudyLock() {
    if (this.studyLockRaf !== null) {
      cancelAnimationFrame(this.studyLockRaf);
      this.studyLockRaf = null;
    }
  }

  async startNewDive({ subjects, settings }) {
    this.timer.stop();
    this.stopStudyLock();

    const krillion = generateRandomKrillion({
      subjects,
      roundsCount: settings.roundsPerDive,
      promptDirection: settings.promptDirection,
      roundDurationSec: settings.roundDurationSec,
    });

    this.session = {
      ...krillion,
      settings: { ...settings },
      phase: 'warming_ai', // 'warming_ai' | 'answering' | 'judging' | 'reveal' | 'finished'
      currentRoundIndex: 0,
      totalDepthMeters: 0,
      totalPoints: 0,
      timerSnapshot: {
        elapsedMs: 0,
        remainingMs: settings.roundDurationSec * 1000,
        ratioRemaining: 1,
        durationMs: settings.roundDurationSec * 1000,
      },
      livePasses: [],
      lastRoundOutcome: null,
      studyLockTotalMs: 0,
      studyLockRemainingMs: 0,
      completedRounds: [],
      aiError: null,
    };

    if (typeof this.onDepthChange === 'function') {
      this.onDepthChange(0, null);
    }
    this.emit();

    try {
      if (this.kevClient.status.state !== 'ready') {
        await this.kevClient.preloadModel(settings.modelOptions || {});
      }
      this.beginCurrentRound();
    } catch (err) {
      this.session.aiError = err.message || 'Failed to load Kev-0.6B model.';
      this.emit();
    }
  }

  beginCurrentRound() {
    if (!this.session) return;
    this.stopStudyLock();
    const round = this.session.rounds[this.session.currentRoundIndex];
    const durationMs = round.durationSec * 1000;

    this.session.phase = 'answering';
    this.session.livePasses = [];
    this.session.lastRoundOutcome = null;
    this.session.studyLockTotalMs = 0;
    this.session.studyLockRemainingMs = 0;
    this.session.aiError = null;
    this.session.timerSnapshot = {
      elapsedMs: 0,
      remainingMs: durationMs,
      ratioRemaining: 1,
      durationMs,
    };

    this.soundFx?.playSonarPing();
    this.emit();

    this.timer.start(round.durationSec, {
      onTick: (snap) => {
        if (!this.session || this.session.phase !== 'answering') return;
        this.session.timerSnapshot = snap;
        this.emit({ tickOnly: true });
      },
      onTimeout: () => {
        this.handleTimeout();
      },
    });
  }

  async submitAnswer(rawUserAnswer) {
    if (!this.session || this.session.phase !== 'answering') return;
    const userAnswer = String(rawUserAnswer ?? '').trim();
    if (!userAnswer) return;

    const elapsedMs = this.timer.freeze();
    const round = this.session.rounds[this.session.currentRoundIndex];
    const durationMs = round.durationSec * 1000;

    this.session.phase = 'judging';
    this.session.livePasses = [];
    this.session.frozenElapsedMs = elapsedMs;
    this.emit();

    try {
      const verdict = await this.kevClient.judgeAnswer(
        {
          subjectName: round.subjectName,
          direction: round.direction,
          promptText: round.promptText,
          expectedAnswer: round.expectedAnswer,
          expectedAnswers: round.expectedAnswers,
          userAnswer,
          threshold: this.session.settings.kevThreshold ?? 0.52,
          modelOptions: this.session.settings.modelOptions || {},
        },
        (passRecord) => {
          if (!this.session) return;
          this.session.livePasses = [...this.session.livePasses, passRecord];
          this.soundFx?.playPassTick(passRecord.passNumber, passRecord.passedIndividually);
          this.emit();
        }
      );

      this.finalizeRound({
        round,
        userAnswer,
        elapsedMs,
        durationMs,
        timedOut: false,
        gaveUp: false,
        forcedStudyMs: 0,
        verdict,
      });
    } catch (err) {
      this.session.phase = 'answering';
      this.session.aiError = `Kev judging error: ${err.message}`;
      this.emit();
    }
  }

  /**
   * "Give Up" forces the player to look at the stored real answer for the
   * remaining time on the round clock before allowing them to advance!
   */
  giveUpRound() {
    if (!this.session || this.session.phase !== 'answering') return;
    const elapsedMs = this.timer.freeze();
    const round = this.session.rounds[this.session.currentRoundIndex];
    const durationMs = round.durationSec * 1000;
    const remainingMs = Math.max(1000, durationMs - elapsedMs);

    this.finalizeRound({
      round,
      userAnswer: '',
      elapsedMs,
      durationMs,
      timedOut: false,
      gaveUp: true,
      forcedStudyMs: remainingMs,
      verdict: {
        isValid: false,
        averageProbability: 0,
        threshold: this.session.settings.kevThreshold ?? 0.52,
        passes: [],
        reason: 'Player gave up — study the stored answer for the remaining round time.',
      },
    });
  }

  handleTimeout() {
    if (!this.session || this.session.phase !== 'answering') return;
    const round = this.session.rounds[this.session.currentRoundIndex];
    const durationMs = round.durationSec * 1000;
    this.finalizeRound({
      round,
      userAnswer: '',
      elapsedMs: durationMs,
      durationMs,
      timedOut: true,
      gaveUp: false,
      forcedStudyMs: 0,
      verdict: {
        isValid: false,
        averageProbability: 0,
        threshold: this.session.settings.kevThreshold ?? 0.52,
        passes: [],
        reason: 'Time expired — review the stored answer below.',
      },
    });
  }

  finalizeRound({
    round,
    userAnswer,
    elapsedMs,
    durationMs,
    timedOut,
    gaveUp,
    forcedStudyMs,
    verdict,
  }) {
    const score = computeDepthFromTime({
      isValid: verdict.isValid,
      elapsedMs,
      durationMs,
      scoringMode: this.session.settings.scoringMode || 'interpolated',
    });

    const prevDepth = this.session.totalDepthMeters;
    this.session.totalDepthMeters += score.depthMeters;
    this.session.totalPoints += score.points;

    const outcome = {
      ...round,
      userAnswer,
      elapsedMs,
      durationMs,
      timedOut,
      gaveUp,
      isValid: verdict.isValid,
      verdict,
      points: score.points,
      depthGained: score.depthMeters,
      cumulativeDepth: this.session.totalDepthMeters,
      tier: score.tier,
    };

    this.session.lastRoundOutcome = outcome;
    this.session.completedRounds.push(outcome);
    this.session.phase = 'reveal';
    this.session.studyLockTotalMs = forcedStudyMs || 0;
    this.session.studyLockRemainingMs = forcedStudyMs || 0;

    if (verdict.isValid) {
      this.soundFx?.playDescentReward(score.tier.id);
      if (typeof this.onDepthChange === 'function') {
        this.onDepthChange(this.session.totalDepthMeters, score.tier, prevDepth);
      }
    } else {
      this.soundFx?.playNoEcho();
    }

    this.emit();

    if (forcedStudyMs > 0) {
      this.startGiveUpStudyCountdown(forcedStudyMs);
    }
  }

  startGiveUpStudyCountdown(totalMs) {
    this.stopStudyLock();
    const start = performance.now();

    const tick = (now) => {
      if (!this.session || this.session.phase !== 'reveal') return;
      const rem = Math.max(0, totalMs - (now - start));
      this.session.studyLockRemainingMs = rem;

      if (rem <= 0) {
        this.session.studyLockRemainingMs = 0;
        this.studyLockRaf = null;
        this.soundFx?.playSonarPing();
        this.emit();
        return;
      }

      this.emit({ studyLockTickOnly: true });
      this.studyLockRaf = requestAnimationFrame(tick);
    };

    this.studyLockRaf = requestAnimationFrame(tick);
  }

  advanceNextRound() {
    if (!this.session || this.session.phase !== 'reveal') return null;
    if (this.session.studyLockRemainingMs > 0) return null; // Blocked until Give Up timer ends!

    if (this.session.currentRoundIndex + 1 >= this.session.rounds.length) {
      this.session.phase = 'finished';
      this.soundFx?.playDiveComplete();
      this.emit();
      return {
        diveId: this.session.diveId,
        subjectIds: this.session.subjectIds,
        subjectNames: this.session.subjectNames,
        totalDepthMeters: this.session.totalDepthMeters,
        totalPoints: this.session.totalPoints,
        rounds: this.session.completedRounds,
      };
    }

    this.session.currentRoundIndex += 1;
    this.beginCurrentRound();
    return null;
  }

  abortDive() {
    this.timer.stop();
    this.stopStudyLock();
    this.session = null;
    if (typeof this.onDepthChange === 'function') {
      this.onDepthChange(0, null);
    }
    this.emit();
  }

  emit(meta = {}) {
    if (typeof this.onUpdate === 'function') {
      this.onUpdate(this.session, meta);
    }
  }
}
