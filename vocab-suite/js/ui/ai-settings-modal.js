/**
 * Kev-0.6B AI Classifier Console, Threshold Tuner & Live 3-Pass Playground Modal
 */

import { escapeHtml, formatPercent, formatBytesMb } from './dom-helpers.js';

export class AiSettingsModal {
  constructor(modalRoot, { kevClient, getSettings, onUpdateSettings }) {
    this.modalRoot = modalRoot;
    this.kevClient = kevClient;
    this.getSettings = getSettings;
    this.onUpdateSettings = onUpdateSettings;
    this.testResult = null;
    this.testRunning = false;
    this.testLivePasses = [];
    this.sampleInputs = {
      term: 'Bioluminescence',
      definition: 'The production and emission of light by a living organism via chemical reaction.',
      userAnswer: 'Light produced chemically by living sea creatures',
    };
  }

  open() {
    this.modalRoot.hidden = false;
    this.render();
  }

  close() {
    this.modalRoot.hidden = true;
    this.modalRoot.innerHTML = '';
  }

  render() {
    if (this.modalRoot.hidden) return;
    const settings = this.getSettings();
    const status = this.kevClient.status;
    const pct = Math.round((status.progress || 0) * 100);

    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" id="ai-modal-backdrop">
        <div class="modal-dialog glass-card modal-lg" role="dialog" aria-modal="true">
          <header class="modal-header">
            <div>
              <span class="eyebrow-badge">WEBGPU / WASM CLASSIFIER ENGINE</span>
              <h2>Kev-0.6B · 3-Pass Answer Verifier</h2>
            </div>
            <button type="button" class="modal-close-btn" id="ai-close-btn" aria-label="Close">✕</button>
          </header>

          <div class="modal-body">
            <!-- Model Telemetry & Preload -->
            <div class="ai-status-panel">
              <div class="ai-status-top">
                <div>
                  <strong>Active Model:</strong> <code>onnx-community/kev-0.6b-ONNX</code>
                  <p class="muted-sub">
                    Smallest browser-ready Kev model (Qwen3-0.6B + Rank-16 LoRA + Pointer Head · ~330 MB q4f16).
                    Streams directly from Hugging Face CDN into your browser cache — zero large files needed on GitHub!
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  id="preload-kev-btn"
                  ${status.state === 'loading' ? 'disabled' : ''}
                >
                  ${
                    status.state === 'ready'
                      ? '✓ Kev-0.6B Loaded'
                      : status.state === 'loading'
                      ? `Loading ${pct}%…`
                      : 'Download & Warm Up Kev-0.6B'
                  }
                </button>
              </div>

              ${
                status.state === 'loading'
                  ? `
                    <div class="kev-progress-track">
                      <div class="kev-progress-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="kev-progress-meta">
                      <span>${escapeHtml(status.message)}</span>
                      <span>${
                        status.total > 0
                          ? `${formatBytesMb(status.loaded)} / ${formatBytesMb(status.total)}`
                          : `${pct}%`
                      }</span>
                    </div>
                  `
                  : `<div class="status-chip-line">Status: <strong>${escapeHtml(
                      status.message
                    )}</strong></div>`
              }
            </div>

            <!-- 3-Pass Threshold & Speed Curve Settings -->
            <div class="settings-two-col">
              <div class="field-block">
                <label>
                  3-Pass Averaged Validity Threshold:
                  <strong id="thresh-readout">${formatPercent(settings.kevThreshold)}</strong>
                </label>
                <input
                  type="range"
                  id="kev-thresh-slider"
                  min="0.35"
                  max="0.80"
                  step="0.01"
                  value="${settings.kevThreshold}"
                />
                <small class="hint-text">
                  Averages Pass 1 (Semantic noul), Pass 2 (Entailment choice), and Pass 3 (Reversed-order rubric).
                </small>
              </div>

              <div class="field-block">
                <label>Time-to-Depth Formula</label>
                <div class="pill-group">
                  <button
                    type="button"
                    class="pill-opt ${settings.scoringMode === 'interpolated' ? 'active' : ''}"
                    data-score-mode="interpolated"
                  >Exact Speed Curve (100–1,000m)</button>
                  <button
                    type="button"
                    class="pill-opt ${settings.scoringMode === 'banded' ? 'active' : ''}"
                    data-score-mode="banded"
                  >6 Classic Tier Bands</button>
                </div>
                <small class="hint-text">
                  Timer freezes the instant you hit Enter so Kev inference never reduces your depth.
                </small>
              </div>
            </div>

            <!-- Interactive 3-Pass Kev Test Bench -->
            <div class="test-bench-card">
              <h3>Live 3-Pass Kev Classifier Test Bench</h3>
              <div class="bench-inputs">
                <div class="field-block">
                  <label>Sample Stored Term</label>
                  <input type="text" id="bench-term" class="input-field" value="${escapeHtml(
                    this.sampleInputs.term
                  )}" />
                </div>
                <div class="field-block">
                  <label>Sample Stored Definition</label>
                  <input type="text" id="bench-def" class="input-field" value="${escapeHtml(
                    this.sampleInputs.definition
                  )}" />
                </div>
                <div class="field-block">
                  <label>Simulated Player Answer (Definition)</label>
                  <input type="text" id="bench-user" class="input-field" value="${escapeHtml(
                    this.sampleInputs.userAnswer
                  )}" />
                </div>
              </div>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                id="run-bench-btn"
                ${this.testRunning ? 'disabled' : ''}
              >
                ${this.testRunning ? 'Running 3 Kev Passes…' : '▶ Run 3-Pass Verification Test'}
              </button>

              ${this.renderBenchOutput()}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderBenchOutput() {
    if (this.testRunning && this.testLivePasses.length > 0) {
      return `
        <div class="bench-results">
          ${this.testLivePasses
            .map(
              (p) =>
                `<span class="pass-pill">${escapeHtml(p.passLabel)}: <strong>${formatPercent(
                  p.validProbability
                )}</strong></span>`
            )
            .join('')}
        </div>
      `;
    }
    if (!this.testResult) return '';
    if (this.testResult.error) {
      return `<div class="error-banner compact">${escapeHtml(this.testResult.error)}</div>`;
    }

    const r = this.testResult;
    return `
      <div class="bench-results">
        <div class="bench-verdict ${r.isValid ? 'valid' : 'invalid'}">
          <strong>${r.isValid ? '✓ VALID ANSWER' : '✕ INVALID ANSWER'}</strong>
          <span>3-Pass Average: <strong>${formatPercent(r.averageProbability)}</strong> (Threshold ${formatPercent(
      r.threshold
    )}) · ${r.totalLatencyMs} ms</span>
        </div>
        <div class="three-pass-pills">
          ${(r.passes || [])
            .map(
              (p) => `
              <div class="pass-pill ${p.validProbability >= 0.5 ? 'pass-pos' : 'pass-neg'}">
                <span>${escapeHtml(p.passLabel)}</span>
                <strong>${formatPercent(p.validProbability)} (${p.latencyMs}ms)</strong>
              </div>
            `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  bindEvents() {
    const q = (sel) => this.modalRoot.querySelector(sel);
    const qa = (sel) => this.modalRoot.querySelectorAll(sel);

    q('#ai-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'ai-modal-backdrop') this.close();
    });
    q('#ai-close-btn')?.addEventListener('click', () => this.close());

    q('#preload-kev-btn')?.addEventListener('click', async () => {
      try {
        await this.kevClient.preloadModel();
      } catch {
        // status listener updates UI
      }
      this.render();
    });

    const slider = q('#kev-thresh-slider');
    slider?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      const readout = q('#thresh-readout');
      if (readout) readout.textContent = formatPercent(val);
      this.onUpdateSettings?.({ kevThreshold: val });
    });

    qa('[data-score-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.onUpdateSettings?.({ scoringMode: btn.dataset.scoreMode });
        this.render();
      });
    });

    q('#run-bench-btn')?.addEventListener('click', async () => {
      this.sampleInputs = {
        term: q('#bench-term')?.value || '',
        definition: q('#bench-def')?.value || '',
        userAnswer: q('#bench-user')?.value || '',
      };
      this.testRunning = true;
      this.testLivePasses = [];
      this.testResult = null;
      this.render();

      try {
        const settings = this.getSettings();
        const verdict = await this.kevClient.judgeAnswer(
          {
            subjectName: 'Test Bench',
            direction: 'term_to_def',
            promptText: this.sampleInputs.term,
            expectedAnswer: this.sampleInputs.definition,
            userAnswer: this.sampleInputs.userAnswer,
            threshold: settings.kevThreshold,
          },
          (passRec) => {
            this.testLivePasses.push(passRec);
            this.render();
          }
        );
        this.testResult = verdict;
      } catch (err) {
        this.testResult = { error: err.message };
      } finally {
        this.testRunning = false;
        this.render();
      }
    });
  }
}
