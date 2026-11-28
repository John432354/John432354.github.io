/**
 * Game 2 View: Multi-Answer Unlimited Vocab Wordle Clone
 *
 * - Displays the Stored Definition clue + Subject/Unit/Topic breadcrumb.
 * - Renders simultaneous Wordle boards for every `-`-separated valid answer
 *   so players can work on multiple answers at once and win by finding ANY ONE.
 * - Unlimited tries, zero AI correction, physical + on-screen QWERTY keyboard.
 * - Dynamic Skip Cooldown scaled to answer & explanation length, displaying
 *   all valid answers + optional `// Java comment` explanation at the end of every question.
 */

import { buildKeyboardLetterMap } from '../wordle/wordle-evaluator.js';
import { escapeHtml, formatSeconds } from './dom-helpers.js';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

export class VocabWordleView {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.active = false;
    this.handleWindowKeyDown = this.handleWindowKeyDown.bind(this);
  }

  mountKeyboardListener() {
    if (this.active) return;
    this.active = true;
    window.addEventListener('keydown', this.handleWindowKeyDown);
  }

  unmountKeyboardListener() {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener('keydown', this.handleWindowKeyDown);
  }

  handleWindowKeyDown(e) {
    if (!this.active) return;
    // Ignore when a modal or text input is focused
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!document.getElementById('modal-root')?.hidden) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'Enter' || e.key === 'Backspace' || /^[A-Za-z0-9]$/.test(e.key)) {
      e.preventDefault();
      this.callbacks.onKeyInput?.(e.key);
    }
  }

  render(state, meta = {}) {
    if (!state) {
      this.unmountKeyboardListener();
      return;
    }
    this.mountKeyboardListener();

    if (meta.cooldownTickOnly && state.phase === 'skipped_cooldown') {
      this.updateCooldownDom(state);
      return;
    }

    const { card, boards, currentInput, focusedBoardIndex, phase, stats } = state;
    const isEnded = phase === 'solved' || phase === 'skipped_cooldown' || phase === 'skipped_ready';
    const isCooldownLocked = phase === 'skipped_cooldown' && state.cooldownRemainingMs > 0;

    // Aggregate keyboard colors from focused board (if chosen) or across all boards
    const keySourceGuesses =
      focusedBoardIndex !== null && boards[focusedBoardIndex]
        ? boards[focusedBoardIndex].guesses
        : boards.flatMap((b) => b.guesses);
    const keyStateMap = buildKeyboardLetterMap(keySourceGuesses);

    const crumbs = [card.subjectName];
    if (card.unit) crumbs.push(card.unit);
    if (card.topic && card.topic !== 'General') crumbs.push(card.topic);

    this.container.innerHTML = `
      <section class="wordle-shell">
        <!-- Top Wordle Header & Clue -->
        <header class="wordle-header glass-card">
          <div class="wordle-meta-top">
            <div class="round-pills">
              <span class="round-counter">WORD #${state.questionNumber}</span>
              <span class="subj-badge" style="border-color:${escapeHtml(card.subjectAccent)}66">
                ${escapeHtml(card.subjectIcon)} ${crumbs.map(escapeHtml).join(' › ')}
              </span>
              <span class="wordle-mode-badge">
                UNLIMITED TRIES · ${
                  boards.length > 1
                    ? `${boards.length} VALID ANSWERS (SOLVE ANY 1!)`
                    : `${boards[0].length} LETTERS`
                }
              </span>
            </div>

            <div class="wordle-stats-mini">
              <span>Solved: <strong class="accent-green">${stats.solved}</strong></span>
              <span>Streak: <strong class="accent-cyan">${stats.streak}</strong></span>
              <button type="button" class="link-btn danger-link" id="wordle-quit-btn">Exit to Hub</button>
            </div>
          </div>

          <div class="wordle-clue-box">
            <span class="prompt-kicker">STORED DEFINITION CLUE</span>
            <h2 class="wordle-clue-text">${escapeHtml(card.definition)}</h2>
            ${
              boards.length > 1 && phase === 'playing'
                ? `<p class="multi-board-tip">
                    💡 <strong>Multi-Answer Mode:</strong> Work on all ${
                      boards.length
                    } valid answers simultaneously! Type any ${state.uniqueLengths.join(
                    '- or '
                  )}-letter word and press <strong>Enter</strong> (or click a board to focus just one). Finding <strong>any single answer</strong> wins!
                    ${
                      focusedBoardIndex !== null
                        ? `<button type="button" class="link-btn" id="unfocus-board-btn">Show All Boards Broadcast</button>`
                        : ''
                    }
                  </p>`
                : ''
            }
          </div>

          ${
            state.feedbackMessage
              ? `<div class="wordle-feedback-toast">${escapeHtml(state.feedbackMessage)}</div>`
              : ''
          }
        </header>

        <!-- End-of-Question Reveal Banner (Solved OR Skipped Cooldown) -->
        ${isEnded ? this.renderEndedRevealCard(state, isCooldownLocked) : ''}

        <!-- Simultaneous Multi-Answer Wordle Boards -->
        <div class="wordle-boards-grid boards-count-${Math.min(4, boards.length)}">
          ${boards
            .map((board) =>
              this.renderSingleBoard(board, {
                currentInput,
                focusedBoardIndex,
                phase,
                isMulti: boards.length > 1,
                isWinner: state.winningBoardIndex === board.boardIndex,
              })
            )
            .join('')}
        </div>

        <!-- Controls & On-Screen QWERTY Keyboard (shown while playing) -->
        ${
          phase === 'playing'
            ? `
              <div class="wordle-keyboard-card glass-card">
                <div class="wordle-action-bar">
                  <span class="typed-counter">
                    Typing: <strong>${currentInput.length}</strong> letter${
                currentInput.length === 1 ? '' : 's'
              } (Target length${state.uniqueLengths.length > 1 ? 's' : ''}: ${state.uniqueLengths.join(', ')})
                  </span>
                  <div class="wordle-action-btns">
                    <button
                      type="button"
                      class="btn btn-danger btn-sm"
                      id="wordle-skip-btn"
                      title="Skips this word and displays the answer during a length-based study cooldown"
                    >
                      ⏭ Skip (Answer Cooldown)
                    </button>
                    <button type="button" class="btn btn-primary btn-sm" id="wordle-submit-btn">
                      Submit Guess ⏎
                    </button>
                  </div>
                </div>

                <div class="qwerty-rows">
                  ${KEYBOARD_ROWS.map(
                    (row) => `
                    <div class="qwerty-row">
                      ${row
                        .map((k) => {
                          const code = k === 'ENTER' ? 'Enter' : k === '⌫' ? 'Backspace' : k;
                          const colorClass = keyStateMap[k] ? `key-${keyStateMap[k]}` : '';
                          const wideClass = k === 'ENTER' || k === '⌫' ? 'key-wide' : '';
                          return `
                            <button
                              type="button"
                              class="qwerty-key ${colorClass} ${wideClass}"
                              data-wkey="${code}"
                            >${k}</button>
                          `;
                        })
                        .join('')}
                    </div>
                  `
                  ).join('')}
                </div>
              </div>
            `
            : ''
        }
      </section>
    `;

    this.bindEvents();

    // Auto-scroll guess history containers to bottom so latest unlimited try is visible
    this.container.querySelectorAll('.board-rows-scroll').forEach((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }

  renderSingleBoard(board, { currentInput, focusedBoardIndex, phase, isMulti, isWinner }) {
    const isFocused = focusedBoardIndex === board.boardIndex;
    const receivesLiveInput =
      phase === 'playing' &&
      !board.solved &&
      (focusedBoardIndex === null || isFocused) &&
      currentInput.length <= board.length;

    return `
      <article
        class="wordle-board-card glass-card ${isFocused ? 'board-focused' : ''} ${
      isWinner ? 'board-winner' : ''
    }"
        data-board-idx="${board.boardIndex}"
      >
        <div class="board-card-head">
          <span>
            <strong>${isMulti ? `Valid Answer #${board.boardIndex + 1}` : 'Target Term'}</strong>
            <small>(${board.length} letters · ${board.guesses.length} ${
      board.guesses.length === 1 ? 'try' : 'tries'
    })</small>
          </span>
          ${
            isWinner
              ? `<span class="solved-pill">✓ SOLVED!</span>`
              : isMulti && phase === 'playing'
              ? `<span class="focus-pill">${isFocused ? '🎯 Focused' : 'Click to focus'}</span>`
              : ''
          }
        </div>

        <div class="board-rows-scroll">
          ${board.guesses
            .map((g) => this.renderTileRow(board.length, g.letters, g.states, board.spaceBeforeIndices))
            .join('')}

          ${
            phase === 'playing' && !board.solved
              ? this.renderTileRow(
                  board.length,
                  receivesLiveInput ? currentInput : [],
                  null,
                  board.spaceBeforeIndices,
                  true
                )
              : ''
          }

          ${
            board.guesses.length === 0 && phase !== 'playing'
              ? `<p class="muted-empty-row">No guesses entered on this board.</p>`
              : ''
          }
        </div>
      </article>
    `;
  }

  renderTileRow(length, letters = [], states = null, spaceBeforeSet = new Set(), isActiveInput = false) {
    const tiles = [];
    for (let i = 0; i < length; i += 1) {
      if (spaceBeforeSet && spaceBeforeSet.has(i)) {
        tiles.push('<span class="word-gap-dot" aria-hidden="true">·</span>');
      }
      const ch = letters[i] || '';
      const stateClass = states ? `tile-${states[i]}` : ch ? 'tile-filled' : 'tile-empty';
      tiles.push(
        `<span class="w-tile ${stateClass} ${isActiveInput ? 'is-live' : ''}">${escapeHtml(ch)}</span>`
      );
    }
    return `<div class="w-row" style="--tile-count:${length}">${tiles.join('')}</div>`;
  }

  renderEndedRevealCard(state, isCooldownLocked) {
    const { card, phase, winningBoardIndex, boards } = state;
    const isSolved = phase === 'solved';
    const remSec = formatSeconds(state.cooldownRemainingMs);
    const totalSec = formatSeconds(state.cooldownTotalMs);

    return `
      <div class="wordle-reveal-banner glass-card ${isSolved ? 'solved' : 'skipped'}">
        <div class="wordle-reveal-head">
          <div>
            <span class="eyebrow-badge">
              ${
                isSolved
                  ? `✓ SOLVED IN ${boards[winningBoardIndex]?.guesses.length || 1} TRIES!`
                  : `SKIPPED · DYNAMIC ANSWER COOLDOWN (${totalSec})`
              }
            </span>
            <h3>Stored Valid Answer${card.terms.length > 1 ? 's' : ''}:</h3>
            <div class="stored-answer-badges">
              ${card.terms
                .map(
                  (t, idx) =>
                    `<span class="real-ans-chip ${
                      idx === winningBoardIndex ? 'winner-chip' : ''
                    }">${escapeHtml(t)}</span>`
                )
                .join('')}
            </div>
          </div>

          <div class="wordle-next-wrap">
            <button
              type="button"
              class="btn btn-primary"
              id="wordle-next-btn"
              ${isCooldownLocked ? 'disabled' : ''}
            >
              ${isCooldownLocked ? `Cooldown (${remSec})…` : 'Next Vocab Word →'}
            </button>
          </div>
        </div>

        ${
          card.explanation
            ? `<div class="comp-box explanation-box" style="margin-top:12px">
                <span class="comp-label">// EXPLANATION</span>
                <p class="comp-val">${escapeHtml(card.explanation)}</p>
              </div>`
            : ''
        }

        ${
          phase === 'skipped_cooldown' || phase === 'skipped_ready'
            ? `
              <div class="study-lock-box" style="margin-top:12px">
                <div class="study-lock-row">
                  <span>⏳ Dynamic Skip Cooldown (scaled to answer${
                    card.explanation ? ' & explanation' : ''
                  } length)</span>
                  <strong id="wordle-cooldown-clock">${
                    isCooldownLocked ? `${remSec} left` : 'Unlocked!'
                  }</strong>
                </div>
                <div class="timer-bar-wrap">
                  <div
                    class="timer-bar-fill"
                    id="wordle-cooldown-bar"
                    style="width: ${
                      isCooldownLocked
                        ? Math.round((state.cooldownRemainingMs / Math.max(1, state.cooldownTotalMs)) * 100)
                        : 0
                    }%"
                  ></div>
                </div>
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  updateCooldownDom(state) {
    const rem = state.cooldownRemainingMs || 0;
    const total = Math.max(1, state.cooldownTotalMs || 1);
    const clockEl = this.container.querySelector('#wordle-cooldown-clock');
    const barEl = this.container.querySelector('#wordle-cooldown-bar');
    const btnEl = this.container.querySelector('#wordle-next-btn');

    if (clockEl) clockEl.textContent = `${formatSeconds(rem)} left`;
    if (barEl) barEl.style.width = `${Math.max(0, Math.min(100, (rem / total) * 100)).toFixed(1)}%`;
    if (btnEl) {
      btnEl.disabled = rem > 0;
      btnEl.textContent = rem > 0 ? `Cooldown (${formatSeconds(rem)})…` : 'Next Vocab Word →';
    }
  }

  bindEvents() {
    const q = (sel) => this.container.querySelector(sel);
    const qa = (sel) => this.container.querySelectorAll(sel);

    q('#wordle-quit-btn')?.addEventListener('click', () => {
      this.unmountKeyboardListener();
      this.callbacks.onQuitWordle?.();
    });
    q('#unfocus-board-btn')?.addEventListener('click', () => {
      this.callbacks.onFocusBoard?.(null);
    });
    q('#wordle-submit-btn')?.addEventListener('click', () => {
      this.callbacks.onKeyInput?.('Enter');
    });
    q('#wordle-skip-btn')?.addEventListener('click', () => {
      this.callbacks.onSkipQuestion?.();
    });
    q('#wordle-next-btn')?.addEventListener('click', () => {
      this.callbacks.onNextWord?.();
    });

    qa('[data-board-idx]').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        const idx = Number(cardEl.dataset.boardIdx);
        this.callbacks.onFocusBoard?.(idx);
      });
    });

    qa('[data-wkey]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onKeyInput?.(btn.dataset.wkey);
      });
    });
  }
}
