/**
 * Multi-Answer Unlimited Vocab Wordle Engine
 *
 * Features:
 * - Carries over the full Subject / Unit / Topic vocabulary bank.
 * - Unlimited tries per question and zero AI-assisted correction.
 * - Simultaneous Multi-Answer Boards: when an item has `-`-separated valid
 *   answers (`Acerbic - Caustic - Biting`), all boards appear together so the
 *   player can work on multiple answers at once — solving ANY ONE wins!
 * - Dynamic Skip Cooldown: skipping locks the screen while showing all valid
 *   answers + optional Java-comment explanation for a duration scaled to text length.
 */

import { fisherYatesShuffle } from '../game/krillion-generator.js';
import {
  prepareWordleTarget,
  evaluateWordleGuess,
  computeDynamicSkipCooldownMs,
} from './wordle-evaluator.js';
import { STORAGE_KEYS } from '../state/storage-keys.js';

export class VocabWordleEngine {
  constructor({ soundFx, onUpdate }) {
    this.soundFx = soundFx;
    this.onUpdate = onUpdate;
    this.state = null;
    this.cooldownRaf = null;
    this.stats = this.loadStats();
  }

  loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WORDLE_STATS);
      return raw
        ? JSON.parse(raw)
        : { solved: 0, skipped: 0, streak: 0, bestStreak: 0, totalGuesses: 0 };
    } catch {
      return { solved: 0, skipped: 0, streak: 0, bestStreak: 0, totalGuesses: 0 };
    }
  }

  saveStats() {
    try {
      localStorage.setItem(STORAGE_KEYS.WORDLE_STATS, JSON.stringify(this.stats));
    } catch {
      // ignore storage quota errors
    }
  }

  getState() {
    return this.state;
  }

  startSession(subjects) {
    this.stopCooldown();
    const pool = [];

    for (const subj of subjects || []) {
      for (const card of subj.cards || []) {
        const rawTerms = Array.isArray(card.terms) && card.terms.length > 0 ? card.terms : [card.term];
        const targets = rawTerms
          .map((t) => prepareWordleTarget(t))
          .filter((t) => t.length > 0);
        if (targets.length === 0) continue;

        pool.push({
          ...card,
          subjectId: subj.id,
          subjectName: subj.name,
          subjectIcon: subj.icon,
          subjectAccent: subj.accent,
          targets,
        });
      }
    }

    if (pool.length === 0) {
      throw new Error('Selected subjects/topics contain no letter-based vocabulary terms.');
    }

    this.deckPool = pool;
    this.bag = fisherYatesShuffle(pool);
    this.questionNumber = 0;
    this.loadNextCard();
  }

  loadNextCard() {
    this.stopCooldown();
    if (!this.deckPool || this.deckPool.length === 0) return;

    if (this.bag.length === 0) {
      this.bag = fisherYatesShuffle(this.deckPool);
    }

    const card = this.bag.shift();
    this.questionNumber += 1;

    const boards = card.targets.map((target, idx) => ({
      boardIndex: idx,
      displayAnswer: target.display,
      letters: target.letters,
      length: target.length,
      spaceBeforeIndices: target.spaceBeforeIndices,
      guesses: [],
      solved: false,
    }));

    const uniqueLengths = [...new Set(boards.map((b) => b.length))].sort((a, b) => a - b);
    const maxLen = Math.max(...uniqueLengths);

    this.state = {
      questionNumber: this.questionNumber,
      totalPoolSize: this.deckPool.length,
      card,
      boards,
      uniqueLengths,
      maxInputLength: maxLen,
      focusedBoardIndex: null, // null = broadcast to all matching-length boards; number = single board focus
      currentInput: [],
      phase: 'playing', // 'playing' | 'solved' | 'skipped_cooldown' | 'skipped_ready'
      winningBoardIndex: null,
      feedbackMessage: null,
      cooldownTotalMs: 0,
      cooldownRemainingMs: 0,
      stats: { ...this.stats },
    };

    this.emit();
  }

  setFocusedBoard(boardIndexOrNull) {
    if (!this.state || this.state.phase !== 'playing') return;
    if (boardIndexOrNull === this.state.focusedBoardIndex) {
      this.state.focusedBoardIndex = null;
    } else {
      this.state.focusedBoardIndex = boardIndexOrNull;
    }

    const cap = this.getActiveMaxInputLength();
    if (this.state.currentInput.length > cap) {
      this.state.currentInput = this.state.currentInput.slice(0, cap);
    }
    this.state.feedbackMessage = null;
    this.emit();
  }

  getActiveMaxInputLength() {
    if (!this.state) return 0;
    if (this.state.focusedBoardIndex !== null) {
      const b = this.state.boards[this.state.focusedBoardIndex];
      return b ? b.length : this.state.maxInputLength;
    }
    return this.state.maxInputLength;
  }

  handleKeyInput(key) {
    if (!this.state) return;

    if (this.state.phase === 'solved' || this.state.phase === 'skipped_ready') {
      if (key === 'Enter') {
        this.loadNextCard();
      }
      return;
    }

    if (this.state.phase !== 'playing') return;

    if (key === 'Backspace') {
      if (this.state.currentInput.length > 0) {
        this.state.currentInput.pop();
        this.state.feedbackMessage = null;
        this.emit();
      }
      return;
    }

    if (key === 'Enter') {
      this.submitCurrentGuess();
      return;
    }

    if (/^[A-Za-z0-9]$/.test(key)) {
      const cap = this.getActiveMaxInputLength();
      if (this.state.currentInput.length < cap) {
        this.state.currentInput.push(key.toUpperCase());
        this.state.feedbackMessage = null;
        this.emit();
      }
    }
  }

  submitCurrentGuess() {
    if (!this.state || this.state.phase !== 'playing') return;
    const guess = [...this.state.currentInput];
    const len = guess.length;

    if (len === 0) return;

    // Identify target boards matching this guess length (or the explicitly focused board)
    let eligibleBoards = [];
    if (this.state.focusedBoardIndex !== null) {
      const fb = this.state.boards[this.state.focusedBoardIndex];
      if (fb && !fb.solved && fb.length === len) {
        eligibleBoards = [fb];
      } else if (fb) {
        this.state.feedbackMessage = `Focused Answer #${fb.boardIndex + 1} needs ${fb.length} letters (you typed ${len}).`;
        this.soundFx?.playNoEcho();
        this.emit();
        return;
      }
    } else {
      eligibleBoards = this.state.boards.filter((b) => !b.solved && b.length === len);
    }

    if (eligibleBoards.length === 0) {
      const validStr = this.state.uniqueLengths.join(' or ');
      this.state.feedbackMessage = `Guess length (${len}) doesn't match valid answer length${
        this.state.uniqueLengths.length > 1 ? 's' : ''
      }: ${validStr} letters.`;
      this.soundFx?.playNoEcho();
      this.emit();
      return;
    }

    let solvedBoardIdx = null;
    for (const board of eligibleBoards) {
      const { states, isSolved } = evaluateWordleGuess(guess, board.letters);
      board.guesses.push({ letters: guess, states });
      if (isSolved) {
        board.solved = true;
        if (solvedBoardIdx === null) solvedBoardIdx = board.boardIndex;
      }
    }

    this.state.currentInput = [];
    this.state.feedbackMessage = null;
    this.stats.totalGuesses += 1;

    if (solvedBoardIdx !== null) {
      this.state.phase = 'solved';
      this.state.winningBoardIndex = solvedBoardIdx;
      this.stats.solved += 1;
      this.stats.streak += 1;
      if (this.stats.streak > this.stats.bestStreak) {
        this.stats.bestStreak = this.stats.streak;
      }
      this.state.stats = { ...this.stats };
      this.saveStats();
      this.soundFx?.playDescentReward('one_in_a_krillion');
    } else {
      this.saveStats();
      this.soundFx?.playPassTick(1, true);
    }

    this.emit();
  }

  skipQuestionWithCooldown() {
    if (!this.state || this.state.phase !== 'playing') return;
    this.stopCooldown();

    const durationMs = computeDynamicSkipCooldownMs(this.state.card);
    this.stats.skipped += 1;
    this.stats.streak = 0;
    this.state.stats = { ...this.stats };
    this.saveStats();

    this.state.phase = 'skipped_cooldown';
    this.state.cooldownTotalMs = durationMs;
    this.state.cooldownRemainingMs = durationMs;
    this.soundFx?.playNoEcho();
    this.emit();

    const start = performance.now();
    const tick = (now) => {
      if (!this.state || this.state.phase !== 'skipped_cooldown') return;
      const elapsed = now - start;
      const rem = Math.max(0, durationMs - elapsed);
      this.state.cooldownRemainingMs = rem;

      if (rem <= 0) {
        this.state.phase = 'skipped_ready';
        this.state.cooldownRemainingMs = 0;
        this.cooldownRaf = null;
        this.soundFx?.playSonarPing();
        this.emit();
        return;
      }

      this.emit({ cooldownTickOnly: true });
      this.cooldownRaf = requestAnimationFrame(tick);
    };

    this.cooldownRaf = requestAnimationFrame(tick);
  }

  stopCooldown() {
    if (this.cooldownRaf !== null) {
      cancelAnimationFrame(this.cooldownRaf);
      this.cooldownRaf = null;
    }
  }

  handleKey(key) {
    return this.handleKeyInput(key);
  }

  skipQuestion() {
    return this.skipQuestionWithCooldown();
  }

  advanceToNextWord() {
    if (!this.state) return;
    if (this.state.phase === 'skipped_cooldown' && this.state.cooldownRemainingMs > 0) {
      return; // Locked until dynamic skip cooldown finishes!
    }
    this.loadNextCard();
  }

  quitSession() {
    this.stopCooldown();
    this.state = null;
    this.emit();
  }

  emit(meta = {}) {
    if (typeof this.onUpdate === 'function') {
      this.onUpdate(this.state, meta);
    }
  }
}
