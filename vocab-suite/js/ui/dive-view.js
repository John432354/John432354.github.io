/**
 * Active Krillion Dive Console View
 *
 * Includes:
 * - Unit & Topic breadcrumb context
 * - "Give Up" button that forces viewing the stored real answer for the
 *   remaining round time before unlocking Next Question
 * - Prominent Stored Real Answer(s) + Java-comment Explanation on every outcome
 */

import { previewPotentialDepth } from '../game/depth-calculator.js';
import {
  escapeHtml,
  formatMeters,
  formatPercent,
  formatSeconds,
  formatBytesMb,
} from './dom-helpers.js';

export class ActiveDiveView {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.lastRenderedKey = null;
  }

  render(session, kevStatus, meta = {}) {
    if (!session) return;

    if (meta.tickOnly && session.phase === 'answering') {
      this.updateLiveTimerDom(session);
      return;
    }

    if (meta.studyLockTickOnly && session.phase === 'reveal') {
      this.updateStudyLockDom(session);
      return;
    }

    const round = session.rounds[session.currentRoundIndex];
    const renderKey = `${session.diveId}_${session.currentRoundIndex}_${session.phase}`;

    if (session.phase === 'warming_ai') {
      this.lastRenderedKey = renderKey;
      this.renderWarmingAi(session, kevStatus);
      return;
    }

    if (session.phase === 'judging') {
      this.lastRenderedKey = renderKey;
      this.renderJudging(session, round);
      return;
    }

    if (session.phase === 'reveal') {
      this.lastRenderedKey = renderKey;
      this.renderReveal(session, session.lastRoundOutcome);
      return;
    }

    if (this.lastRenderedKey !== renderKey || session.aiError) {
      this.lastRenderedKey = renderKey;
      this.renderAnswering(session, round);
    }
    this.updateLiveTimerDom(session);
  }

  renderBreadcrumb(round) {
    const crumbs = [round.subjectName];
    if (round.unit) crumbs.push(round.unit);
    if (round.topic && round.topic !== 'General') crumbs.push(round.topic);
    return crumbs.map((c) => escapeHtml(c)).join(' › ');
  }

  renderWarmingAi(session, kevStatus) {
    const pct = Math.round((kevStatus.progress || 0) * 100);
    const bytesInfo =
      kevStatus.total > 0
        ? `${formatBytesMb(kevStatus.loaded)} / ${formatBytesMb(kevStatus.total)}`
        : 'Cached in browser after first run';

    this.container.innerHTML = `
      <section class="dive-stage">
        <div class="dive-card glass-card warming-card">
          <div class="sonar-spinner"></div>
          <span class="eyebrow-badge">PREPARING KEV-0.6B CLASSIFIER</span>
          <h2>Pressurizing Submarine AI Sonar…</h2>
          <p>
            Round timers stay paused until <strong>Kev-0.6B</strong> is online in your browser
            so download time never affects your answer speed or depth.
          </p>
          <div class="kev-progress-track">
            <div class="kev-progress-fill" style="width: ${pct}%"></div>
          </div>
          <div class="kev-progress-meta">
            <span>${escapeHtml(kevStatus.message || 'Loading…')}</span>
            <strong>${pct}% · ${escapeHtml(bytesInfo)}</strong>
          </div>
          ${
            session.aiError
              ? `<div class="error-banner">
                  <p>${escapeHtml(session.aiError)}</p>
                  <div class="error-actions">
                    <button type="button" class="btn btn-primary btn-sm" id="retry-kev-btn">Retry Load</button>
                    <button type="button" class="btn btn-secondary btn-sm" id="abort-dive-btn">Back to Hub</button>
                  </div>
                </div>`
              : `<button type="button" class="btn btn-secondary btn-sm" id="abort-dive-btn">Cancel Dive</button>`
          }
        </div>
      </section>
    `;

    this.container.querySelector('#abort-dive-btn')?.addEventListener('click', () =>
      this.callbacks.onAbortDive?.()
    );
    this.container.querySelector('#retry-kev-btn')?.addEventListener('click', () =>
      this.callbacks.onRetryDiveLoad?.()
    );
  }

  renderAnswering(session, round) {
    const isDefPrompt = round.direction === 'def_to_term';
    this.container.innerHTML = `
      <section class="dive-stage">
        <div class="dive-card glass-card">
          <div class="dive-top-meta">
            <div class="round-pills">
              <span class="round-counter">ROUND ${round.roundNumber} / ${round.totalRounds}</span>
              <span class="subj-badge" style="border-color:${escapeHtml(round.subjectAccent)}66">
                ${escapeHtml(round.subjectIcon)} ${this.renderBreadcrumb(round)}
              </span>
            </div>
            <button type="button" class="link-btn danger-link" id="dive-abort-btn">Surface / Quit</button>
          </div>

          <div class="timer-bar-wrap">
            <div class="timer-bar-fill" id="live-timer-bar" style="width: 100%"></div>
          </div>
          <div class="timer-telemetry-row">
            <span class="timer-clock" id="live-timer-clock">${round.durationSec.toFixed(1)}s</span>
            <span class="potential-depth-pill" id="live-potential-pill">
              Potential: +1,000 m · One in a Krillion
            </span>
          </div>

          <div class="prompt-display">
            <span class="prompt-kicker">${escapeHtml(round.promptLabel)}</span>
            <h2 class="prompt-main-text ${isDefPrompt ? 'is-definition' : 'is-term'}">
              ${escapeHtml(round.promptText)}
            </h2>
          </div>

          ${
            session.aiError
              ? `<div class="error-banner compact">${escapeHtml(session.aiError)}</div>`
              : ''
          }

          <form class="answer-form" id="dive-answer-form">
            <textarea
              id="dive-answer-input"
              class="answer-textarea"
              rows="${isDefPrompt ? 2 : 3}"
              placeholder="${escapeHtml(round.inputPlaceholder)}"
              autocomplete="off"
              autocorrect="off"
              spellcheck="true"
            ></textarea>
            <div class="answer-actions-row">
              <button
                type="button"
                class="btn btn-danger"
                id="dive-giveup-btn"
                title="Reveals the stored answer and locks Next for the remaining round time"
              >
                🏳️ Give Up (Study Answer)
              </button>
              <button type="submit" class="btn btn-primary btn-dive-submit">
                <span>Transmit Answer · Lock Speed ⏎</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    `;

    const input = this.container.querySelector('#dive-answer-input');
    const form = this.container.querySelector('#dive-answer-form');

    requestAnimationFrame(() => input?.focus());

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form?.requestSubmit();
      }
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = input?.value?.trim() || '';
      if (!val) {
        input?.classList.add('input-shake');
        setTimeout(() => input?.classList.remove('input-shake'), 360);
        return;
      }
      this.callbacks.onSubmitAnswer?.(val);
    });

    this.container.querySelector('#dive-giveup-btn')?.addEventListener('click', () => {
      this.callbacks.onGiveUpRound?.();
    });
    this.container.querySelector('#dive-abort-btn')?.addEventListener('click', () => {
      this.callbacks.onAbortDive?.();
    });
  }

  updateLiveTimerDom(session) {
    const snap = session.timerSnapshot;
    if (!snap) return;

    const barEl = this.container.querySelector('#live-timer-bar');
    const clockEl = this.container.querySelector('#live-timer-clock');
    const potEl = this.container.querySelector('#live-potential-pill');

    if (barEl) {
      const pct = Math.max(0, Math.min(100, snap.ratioRemaining * 100));
      barEl.style.width = `${pct.toFixed(2)}%`;
      barEl.dataset.urgent = snap.ratioRemaining < 0.25 ? 'true' : 'false';
    }
    if (clockEl) {
      clockEl.textContent = formatSeconds(snap.remainingMs);
    }
    if (potEl) {
      const preview = previewPotentialDepth(
        snap.elapsedMs,
        snap.durationMs,
        session.settings.scoringMode
      );
      potEl.textContent = `Speed Lock: +${preview.depthMeters.toLocaleString()} m · ${preview.tier.name}`;
      potEl.style.color = preview.tier.color;
    }
  }

  renderJudging(session, round) {
    const preview = previewPotentialDepth(
      session.frozenElapsedMs || 0,
      round.durationSec * 1000,
      session.settings.scoringMode
    );
    const passes = session.livePasses || [];
    const passLabels = [
      'Pass 1 · Semantic Match (noul)',
      'Pass 2 · Concept Entailment (choice)',
      'Pass 3 · Debiased Rubric (reversed)',
    ];

    this.container.innerHTML = `
      <section class="dive-stage">
        <div class="dive-card glass-card judging-card">
          <div class="speed-locked-banner">
            <span>⏱ Answer Speed Locked at <strong>${formatSeconds(session.frozenElapsedMs)}</strong></span>
            <span style="color:${preview.tier.color}">
              Potential: <strong>+${preview.depthMeters.toLocaleString()} m (${escapeHtml(preview.tier.name)})</strong>
            </span>
          </div>

          <h3>Running 3-Pass Kev-0.6B Verification…</h3>
          <p class="muted-sub">Verifying your answer against the stored reference answer(s).</p>

          <div class="three-pass-grid">
            ${[0, 1, 2]
              .map((idx) => {
                const done = passes[idx];
                return `
                  <div class="pass-sonar-box ${done ? 'completed' : 'running'}">
                    <div class="pass-box-head">
                      <span>${escapeHtml(done ? done.passLabel : passLabels[idx])}</span>
                      <strong>${done ? formatPercent(done.validProbability) : 'Scanning…'}</strong>
                    </div>
                    <div class="pass-mini-bar">
                      <div style="width:${done ? Math.round(done.validProbability * 100) : 35}%"></div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </section>
    `;
  }

  renderReveal(session, outcome) {
    const isLast = session.currentRoundIndex + 1 >= session.rounds.length;
    const verdict = outcome.verdict || {};
    const passes = verdict.passes || [];
    const avgPct = formatPercent(verdict.averageProbability || 0);
    const threshPct = formatPercent(verdict.threshold || 0.52);

    const isLocked = session.studyLockRemainingMs > 0;
    const lockSec = formatSeconds(session.studyLockRemainingMs);
    const allTerms = Array.isArray(outcome.terms) && outcome.terms.length > 0
      ? outcome.terms
      : [outcome.term];

    this.container.innerHTML = `
      <section class="dive-stage">
        <div class="dive-card glass-card reveal-card ${outcome.isValid ? 'is-valid' : 'is-invalid'}">
          <div class="reveal-tier-banner" style="--tier-color: ${outcome.tier.color}; --tier-glow: ${outcome.tier.glow}">
            <div class="tier-headline">
              <span class="tier-kicker">
                ${
                  outcome.isValid
                    ? `CORRECT IN ${formatSeconds(outcome.elapsedMs)} · VERIFIED BY KEV-0.6B`
                    : outcome.timedOut
                    ? 'TIME EXPIRED · STORED REAL ANSWER REVEALED'
                    : outcome.gaveUp
                    ? 'GAVE UP · STUDY THE STORED ANSWER FOR REMAINING TIME'
                    : 'NO ECHO · BELOW KEV 3-PASS THRESHOLD'
                }
              </span>
              <h2 style="color: ${outcome.tier.color}">${escapeHtml(outcome.tier.name)}</h2>
              <p>${escapeHtml(outcome.tier.tagline)}</p>
            </div>
            <div class="tier-depth-award">
              <strong style="color: ${outcome.tier.color}">+${formatMeters(outcome.depthGained)}</strong>
              <span>+${outcome.points} pts · Total ${formatMeters(outcome.cumulativeDepth)}</span>
            </div>
          </div>

          <!-- Always-visible Stored Real Answer(s) + Definition -->
          <div class="comparison-grid">
            <div class="comp-box highlight-expected">
              <span class="comp-label">
                STORED REAL ${outcome.direction === 'def_to_term' ? 'ANSWER(S) · TERM' : 'ANSWER · DEFINITION'}
              </span>
              ${
                outcome.direction === 'def_to_term'
                  ? `<div class="stored-answer-badges">
                      ${allTerms
                        .map((t) => `<span class="real-ans-chip">${escapeHtml(t)}</span>`)
                        .join('')}
                    </div>`
                  : `<p class="comp-val real-ans-strong">${escapeHtml(outcome.definition)}</p>`
              }
            </div>

            <div class="comp-box">
              <span class="comp-label">
                PROMPT SHOWN (${outcome.direction === 'def_to_term' ? 'STORED DEFINITION' : 'STORED TERM(S)'})
              </span>
              <p class="comp-val">${escapeHtml(outcome.promptText)}</p>
            </div>

            <div class="comp-box ${outcome.isValid ? 'user-good' : 'user-miss'}">
              <span class="comp-label">YOUR SUBMITTED ANSWER</span>
              <p class="comp-val">${
                outcome.userAnswer
                  ? escapeHtml(outcome.userAnswer)
                  : outcome.timedOut
                  ? '<em>(Time ran out before submission)</em>'
                  : outcome.gaveUp
                  ? '<em>(Gave up — reviewing stored answer)</em>'
                  : '<em>(No answer submitted)</em>'
              }</p>
            </div>

            ${
              outcome.explanation
                ? `<div class="comp-box explanation-box">
                    <span class="comp-label">// EXPLANATION</span>
                    <p class="comp-val">${escapeHtml(outcome.explanation)}</p>
                  </div>`
                : ''
            }
          </div>

          ${
            passes.length > 0
              ? `
                <div class="kev-breakdown-panel">
                  <div class="kev-breakdown-head">
                    <span>Kev-0.6B 3-Pass Validity Average: <strong>${avgPct}</strong> (Threshold ${threshPct})</span>
                    <span>${verdict.totalLatencyMs || 0} ms total</span>
                  </div>
                  <div class="three-pass-pills">
                    ${passes
                      .map(
                        (p) => `
                        <div class="pass-pill ${p.validProbability >= 0.5 ? 'pass-pos' : 'pass-neg'}">
                          <span>${escapeHtml(p.passLabel)}</span>
                          <strong>${formatPercent(p.validProbability)}</strong>
                        </div>
                      `
                      )
                      .join('')}
                  </div>
                </div>
              `
              : ''
          }

          ${
            session.studyLockTotalMs > 0
              ? `
                <div class="study-lock-box" id="study-lock-box" ${isLocked ? '' : 'hidden'}>
                  <div class="study-lock-row">
                    <span>📖 Read &amp; memorize the stored answer above before advancing</span>
                    <strong id="study-lock-clock">${lockSec} remaining</strong>
                  </div>
                  <div class="timer-bar-wrap">
                    <div class="timer-bar-fill" id="study-lock-bar" style="width: 100%"></div>
                  </div>
                </div>
              `
              : ''
          }

          <div class="reveal-footer">
            <button
              type="button"
              class="btn btn-primary btn-next-round"
              id="next-round-btn"
              ${isLocked ? 'disabled' : ''}
            >
              ${
                isLocked
                  ? `Locked for Study (${lockSec})…`
                  : isLast
                  ? 'View Bathymetric Dive Logbook →'
                  : `Dive to Round ${outcome.roundNumber + 1} →`
              }
            </button>
          </div>
        </div>
      </section>
    `;

    const nextBtn = this.container.querySelector('#next-round-btn');
    if (!isLocked) {
      requestAnimationFrame(() => nextBtn?.focus());
    }
    nextBtn?.addEventListener('click', () => {
      this.callbacks.onAdvanceRound?.();
    });
  }

  updateStudyLockDom(session) {
    const rem = session.studyLockRemainingMs || 0;
    const total = Math.max(1, session.studyLockTotalMs || 1);
    const isLast = session.currentRoundIndex + 1 >= session.rounds.length;
    const nextRoundNum = (session.lastRoundOutcome?.roundNumber || 1) + 1;

    const clockEl = this.container.querySelector('#study-lock-clock');
    const barEl = this.container.querySelector('#study-lock-bar');
    const btnEl = this.container.querySelector('#next-round-btn');

    if (clockEl) clockEl.textContent = `${formatSeconds(rem)} remaining`;
    if (barEl) barEl.style.width = `${Math.max(0, Math.min(100, (rem / total) * 100)).toFixed(1)}%`;
    if (btnEl) {
      if (rem > 0) {
        btnEl.disabled = true;
        btnEl.textContent = `Locked for Study (${formatSeconds(rem)})…`;
      } else {
        btnEl.disabled = false;
        btnEl.textContent = isLast
          ? 'View Bathymetric Dive Logbook →'
          : `Dive to Round ${nextRoundNum} →`;
        btnEl.focus();
      }
    }
  }
}
