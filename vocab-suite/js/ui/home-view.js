/**
 * Educational Games Suite Hub View (`js/ui/home-view.js`)
 *
 * Features:
 * - Drag-and-drop / 1-click `.zip` Subject uploader (`AP Lang.zip` -> Unit folders -> Topic `.txt`)
 * - 1-click Sample `AP Lang.zip` loader + prominent Creator Format Spec link
 * - Hierarchical Subject cards with expandable Unit & Topic filter toggles + `.zip` / `.js` export
 * - Dual Game Launcher:
 *     1) Krillion (Speed-Depth + 3-Pass Kev-0.6B AI + Give-Up Study Lock)
 *     2) Vocab Wordle (Unlimited Tries + Multi-Answer Simultaneous Boards + Dynamic Skip Cooldown)
 */

import { COMPANION_SPECIES } from '../config/constants.js';
import { buildSubjectHierarchyList } from '../../subjects/schema.js';
import { escapeHtml, formatMeters } from './dom-helpers.js';

export class HomeLobbyView {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.selectedGame = 'krillion'; // 'krillion' | 'wordle'
    this.expandedSubjectIds = new Set();
  }

  render({
    subjects,
    selectedSubjectIds,
    filteredSubjects,
    subjectRepo,
    settings,
    stats,
    wordleStats,
    kevStatus,
  }) {
    const activeFilteredCardsCount = (filteredSubjects || []).reduce(
      (sum, s) => sum + (s.cards?.length || 0),
      0
    );
    const hasSubjects = subjects.length > 0;
    const canStart = activeFilteredCardsCount > 0;

    this.container.innerHTML = `
      <section class="lobby-shell">
        <!-- Hero Header -->
        <header class="lobby-hero glass-card">
          <div class="hero-copy">
            <span class="eyebrow-badge">MODULAR EDUCATIONAL VOCAB GAMES SUITE · GITHUB.IO READY</span>
            <h1>One Subject <code>.zip</code> Bank. Two Study Games.</h1>
            <p>
              Upload a <code>&lt;Subject&gt;.zip</code> archive with Topic <code>.txt</code> files
              (optional Unit folders, <code>-</code> multi-answers &amp; <code>//</code> Java-comment explanations),
              then dive into <strong>Krillion</strong> or solve simultaneous boards in <strong>Vocab Wordle</strong>.
            </p>
            <div class="hero-spec-cta-row">
              <button type="button" class="btn btn-secondary btn-sm" id="hero-open-spec-btn">
                📖 Full Creator Spec (.zip &amp; .txt Guide)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="hero-load-sample-btn">
                ⚡ Load Sample "AP Lang.zip"
              </button>
            </div>
          </div>

          <div class="hero-stats-grid">
            <div class="stat-tile">
              <span class="stat-label">KRILLION BEST DEPTH</span>
              <strong class="stat-val accent-cyan">${formatMeters(stats.deepestDiveMeters)}</strong>
            </div>
            <div class="stat-tile">
              <span class="stat-label">DIVES COMPLETED</span>
              <strong class="stat-val">${stats.totalDives}</strong>
            </div>
            <div class="stat-tile">
              <span class="stat-label">WORDLES SOLVED</span>
              <strong class="stat-val accent-green">${wordleStats?.solved || 0}</strong>
            </div>
            <div class="stat-tile">
              <span class="stat-label">WORDLE BEST STREAK</span>
              <strong class="stat-val accent-gold">${wordleStats?.bestStreak || 0}</strong>
            </div>
          </div>
        </header>

        <div class="lobby-columns">
          <!-- Left Column: ZIP Upload + Subject / Unit / Topic Bank -->
          <div class="lobby-panel glass-card">
            <div class="panel-header">
              <div>
                <h2>1. Subject Bank (<code>.zip</code> / Units / Topics)</h2>
                <p>Starts with 0 built-in subjects — upload <code>.zip</code> sets or create in Subject Lab.</p>
              </div>
              <div class="panel-header-btns">
                <button class="btn btn-secondary btn-sm" id="open-subject-lab-btn" type="button">
                  + Manual / .txt
                </button>
              </div>
            </div>

            <!-- Drag-and-drop Subject .zip Uploader -->
            <div class="zip-dropzone" id="zip-dropzone">
              <input
                type="file"
                id="zip-file-input"
                accept=".zip,application/zip"
                multiple
                hidden
              />
              <div class="zip-drop-content">
                <span class="zip-drop-icon">📦</span>
                <div>
                  <strong>Drop Subject <code>.zip</code> file(s) here or <span class="underline-cta">browse</span></strong>
                  <p>e.g. <code>AP Lang.zip</code> containing <code>Unit 1/Tones Vocab.txt</code> · supports <code>-</code> multi-answers &amp; <code>//</code> comments</p>
                </div>
              </div>
            </div>

            ${
              !hasSubjects
                ? this.renderZeroSubjectsState()
                : this.renderSubjectGrid(subjects, selectedSubjectIds, subjectRepo)
            }
          </div>

          <!-- Right Column: Game Switcher & Configuration Console -->
          <div class="lobby-panel glass-card">
            <div class="panel-header">
              <div>
                <h2>2. Choose Your Game</h2>
                <p>${activeFilteredCardsCount} active card${
      activeFilteredCardsCount === 1 ? '' : 's'
    } across ${(filteredSubjects || []).length} selected subject${
      (filteredSubjects || []).length === 1 ? '' : 's'
    }</p>
              </div>
            </div>

            <!-- Suite Game Selector Tabs -->
            <div class="game-switcher-tabs" role="tablist">
              <button
                type="button"
                class="game-switch-tab ${this.selectedGame === 'krillion' ? 'active' : ''}"
                data-game-tab="krillion"
              >
                <span class="game-tab-emoji">🌊</span>
                <div>
                  <strong>Krillion</strong>
                  <small>Speed-Depth · 3-Pass Kev AI</small>
                </div>
              </button>
              <button
                type="button"
                class="game-switch-tab ${this.selectedGame === 'wordle' ? 'active' : ''}"
                data-game-tab="wordle"
              >
                <span class="game-switch-emoji">🟩</span>
                <div>
                  <strong>Vocab Wordle</strong>
                  <small>Unlimited Tries · Multi-Answer</small>
                </div>
              </button>
            </div>

            ${
              this.selectedGame === 'krillion'
                ? this.renderKrillionLauncher({ settings, kevStatus, canStart, activeFilteredCardsCount })
                : this.renderWordleLauncher({ wordleStats, canStart, activeFilteredCardsCount })
            }
          </div>
        </div>
      </section>
    `;

    this.bindEvents(subjectRepo);
  }

  renderZeroSubjectsState() {
    return `
      <div class="empty-subjects-box">
        <div class="empty-radar-icon">📡</div>
        <h3>0 Subjects Loaded</h3>
        <p>
          Upload a <code>&lt;Subject&gt;.zip</code> file above, try the sample
          <strong>AP Lang.zip</strong> archive in one click, or inspect the Creator Spec to make your own!
        </p>
        <div class="empty-cta-row">
          <button class="btn btn-primary btn-sm" id="empty-load-sample-btn" type="button">
            ⚡ Load Sample "AP Lang.zip"
          </button>
          <button class="btn btn-secondary btn-sm" id="empty-open-spec-btn" type="button">
            📖 Read Format Spec
          </button>
        </div>
      </div>
    `;
  }

  renderSubjectGrid(subjects, selectedIds, subjectRepo) {
    const selectedSet = new Set(selectedIds);
    return `
      <div class="subject-cards-grid">
        ${subjects
          .map((subj) => {
            const isSelected = selectedSet.has(subj.id);
            const isExpanded = this.expandedSubjectIds.has(subj.id);
            const hierarchy = buildSubjectHierarchyList(subj);
            const topicCount = hierarchy.reduce((acc, u) => acc + u.topics.length, 0);
            const multiCount = subj.cards.filter((c) => (c.terms?.length || 1) > 1).length;

            return `
              <div
                class="subject-card ${isSelected ? 'selected' : ''}"
                style="--subj-accent: ${escapeHtml(subj.accent || '#38f2ff')}"
              >
                <button
                  type="button"
                  class="subject-select-area"
                  data-toggle-subject="${escapeHtml(subj.id)}"
                >
                  <div class="subject-card-top">
                    <span class="subject-icon">${escapeHtml(subj.icon || '🪼')}</span>
                    <span class="subject-check">${isSelected ? '✓ Active' : 'Select'}</span>
                  </div>
                  <strong class="subject-title">${escapeHtml(subj.name)}</strong>
                  <span class="subject-meta">
                    ${subj.cards.length} terms · ${topicCount} topic${topicCount === 1 ? '' : 's'}${
              multiCount > 0 ? ` · ${multiCount} multi-ans` : ''
            }
                  </span>
                </button>

                <div class="subject-card-actions">
                  <button
                    type="button"
                    class="mini-action"
                    data-expand-units="${escapeHtml(subj.id)}"
                    title="Filter Units & Topics"
                  >${isExpanded ? '▴ Units/Topics' : '▾ Units/Topics'}</button>
                  <button
                    type="button"
                    class="mini-action"
                    data-export-zip="${escapeHtml(subj.id)}"
                    title="Download as Subject .zip"
                  >.zip</button>
                  <button
                    type="button"
                    class="mini-action"
                    data-edit-subject="${escapeHtml(subj.id)}"
                    title="Edit Subject"
                  >Edit</button>
                  ${
                    subj.source !== 'builtin'
                      ? `<button type="button" class="mini-action danger" data-delete-subject="${escapeHtml(
                          subj.id
                        )}" title="Delete">✕</button>`
                      : ''
                  }
                </div>

                ${
                  isExpanded
                    ? this.renderUnitTopicBreakdown(subj, hierarchy, subjectRepo)
                    : ''
                }
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  renderUnitTopicBreakdown(subj, hierarchy, subjectRepo) {
    return `
      <div class="unit-topic-drawer">
        ${hierarchy
          .map((u) => {
            const unitLabel = u.unit || 'Root (No Unit Folder)';
            const allEnabled = u.topics.every((t) =>
              subjectRepo.isTopicEnabled(subj.id, u.unit, t.topic)
            );
            return `
              <div class="unit-group">
                <label class="unit-toggle-row">
                  <input
                    type="checkbox"
                    data-unit-toggle="${escapeHtml(subj.id)}"
                    data-unit-name="${escapeHtml(u.unit)}"
                    ${allEnabled ? 'checked' : ''}
                  />
                  <strong>📁 ${escapeHtml(unitLabel)}</strong>
                </label>
                <div class="topic-chips-wrap">
                  ${u.topics
                    .map((t) => {
                      const on = subjectRepo.isTopicEnabled(subj.id, u.unit, t.topic);
                      return `
                        <button
                          type="button"
                          class="topic-filter-chip ${on ? 'on' : 'off'}"
                          data-topic-toggle="${escapeHtml(subj.id)}"
                          data-unit-name="${escapeHtml(u.unit)}"
                          data-topic-name="${escapeHtml(t.topic)}"
                        >
                          ${on ? '✓' : '○'} ${escapeHtml(t.topic)} <small>(${t.count})</small>
                        </button>
                      `;
                    })
                    .join('')}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  renderKrillionLauncher({ settings, kevStatus, canStart, activeFilteredCardsCount }) {
    return `
      <div class="config-group">
        <label class="config-label">Prompt Direction</label>
        <div class="segmented-group">
          ${[
            { id: 'term_to_def', label: 'Show Term → Type Definition' },
            { id: 'def_to_term', label: 'Show Definition → Type Term' },
            { id: 'mixed', label: 'Mixed Random' },
          ]
            .map(
              (opt) => `
              <button
                type="button"
                class="seg-btn ${settings.promptDirection === opt.id ? 'active' : ''}"
                data-direction="${opt.id}"
              >${opt.label}</button>
            `
            )
            .join('')}
        </div>
      </div>

      <div class="config-row-split">
        <div class="config-group">
          <label class="config-label">Rounds per Krillion</label>
          <div class="segmented-group compact">
            ${[5, 7, 10]
              .map(
                (n) => `
                <button
                  type="button"
                  class="seg-btn ${settings.roundsPerDive === n ? 'active' : ''}"
                  data-rounds="${n}"
                >${n}</button>
              `
              )
              .join('')}
          </div>
        </div>

        <div class="config-group">
          <label class="config-label">Speed Timer</label>
          <div class="segmented-group compact">
            ${[15, 25, 35]
              .map(
                (sec) => `
                <button
                  type="button"
                  class="seg-btn ${settings.roundDurationSec === sec ? 'active' : ''}"
                  data-duration="${sec}"
                >${sec}s</button>
              `
              )
              .join('')}
          </div>
        </div>
      </div>

      <div class="config-group">
        <label class="config-label">Submarine Companion</label>
        <div class="companion-row">
          ${COMPANION_SPECIES.map(
            (c) => `
              <button
                type="button"
                class="companion-chip ${settings.companionId === c.id ? 'active' : ''}"
                data-companion="${c.id}"
              >
                <span>${c.emoji}</span>
                <small>${escapeHtml(c.name)}</small>
              </button>
            `
          ).join('')}
        </div>
      </div>

      <div class="kev-readiness-box">
        <div>
          <span class="kev-mini-title">ANSWER JUDGE · KEV-0.6B (3-PASS AVG + GIVE UP LOCK)</span>
          <p class="kev-mini-desc">
            Threshold <strong>${Math.round(
              settings.kevThreshold * 100
            )}%</strong> · Always displays stored answer &amp; <code>//</code> explanation · <strong>Give Up</strong> locks Next for remaining clock.
          </p>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="lobby-ai-btn">
          ${kevStatus.state === 'ready' ? '✓ Kev Ready' : 'Configure / Preload'}
        </button>
      </div>

      <button
        type="button"
        class="btn btn-launch"
        id="launch-krillion-btn"
        ${canStart ? '' : 'disabled'}
      >
        <span>🌊 Launch Random Krillion Dive</span>
        <small>${
          canStart
            ? `${activeFilteredCardsCount} active cards · Max ${(
                settings.roundsPerDive * 1000
              ).toLocaleString()} m`
            : 'Upload a .zip or select at least 1 active topic'
        }</small>
      </button>
    `;
  }

  renderWordleLauncher({ wordleStats, canStart, activeFilteredCardsCount }) {
    return `
      <div class="wordle-launcher-info">
        <div class="wordle-feature-pills">
          <span class="w-feat-pill">♾️ Unlimited Tries</span>
          <span class="w-feat-pill">🚫 Zero AI Correction</span>
          <span class="w-feat-pill">🔀 Simultaneous <code>-</code> Answer Boards</span>
          <span class="w-feat-pill">⏳ Dynamic-Length Skip Cooldown</span>
        </div>

        <ul class="spec-rules-list" style="margin:12px 0">
          <li><strong>Clue:</strong> You see the Stored Definition (plus Subject › Unit › Topic).</li>
          <li><strong>Multiple Valid Answers:</strong> If a card has <code>Acerbic - Caustic - Biting</code>, all 3 Wordle boards appear side-by-side! Work on any or all at once — solving <strong>any single valid answer</strong> completes the card.</li>
          <li><strong>Skip with Dynamic Cooldown:</strong> Skipping reveals the stored answer(s) + <code>//</code> explanation and holds a cooldown scaled dynamically to the answer's length before unlocking Next.</li>
        </ul>

        <div class="kev-readiness-box">
          <div>
            <span class="kev-mini-title">YOUR VOCAB WORDLE RECORD</span>
            <p class="kev-mini-desc">
              Solved: <strong>${wordleStats?.solved || 0}</strong> · Skipped: <strong>${
      wordleStats?.skipped || 0
    }</strong> · Current Streak: <strong>${wordleStats?.streak || 0}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-launch btn-launch-wordle"
          id="launch-wordle-btn"
          ${canStart ? '' : 'disabled'}
        >
          <span>🟩 Launch Unlimited Vocab Wordle</span>
          <small>${
            canStart
              ? `${activeFilteredCardsCount} active vocab cards ready · Solve any valid - answer`
              : 'Upload a .zip or select at least 1 active topic'
          }</small>
        </button>
      </div>
    `;
  }

  bindEvents() {
    const q = (sel) => this.container.querySelector(sel);
    const qa = (sel) => this.container.querySelectorAll(sel);

    q('#hero-open-spec-btn')?.addEventListener('click', () => this.callbacks.onOpenSpec?.());
    q('#empty-open-spec-btn')?.addEventListener('click', () => this.callbacks.onOpenSpec?.());
    q('#hero-load-sample-btn')?.addEventListener('click', () => this.callbacks.onLoadSampleZip?.());
    q('#empty-load-sample-btn')?.addEventListener('click', () => this.callbacks.onLoadSampleZip?.());
    q('#open-subject-lab-btn')?.addEventListener('click', () =>
      this.callbacks.onOpenSubjectModal?.('create')
    );

    // Drag & Drop + File Input for .zip archives
    const dropzone = q('#zip-dropzone');
    const zipInput = q('#zip-file-input');
    dropzone?.addEventListener('click', () => zipInput?.click());
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-active');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
        f.name.toLowerCase().endsWith('.zip')
      );
      if (files.length > 0) {
        this.callbacks.onUploadZipFiles?.(files);
      }
    });
    zipInput?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        this.callbacks.onUploadZipFiles?.(files);
      }
      zipInput.value = '';
    });

    // Game tabs
    qa('[data-game-tab]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.selectedGame = btn.dataset.gameTab;
        this.callbacks.onRefreshLobby?.();
      })
    );

    // Subject card actions
    qa('[data-toggle-subject]').forEach((btn) =>
      btn.addEventListener('click', () =>
        this.callbacks.onToggleSubject?.(btn.dataset.toggleSubject)
      )
    );
    qa('[data-expand-units]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = btn.dataset.expandUnits;
        if (this.expandedSubjectIds.has(id)) {
          this.expandedSubjectIds.delete(id);
        } else {
          this.expandedSubjectIds.add(id);
        }
        this.callbacks.onRefreshLobby?.();
      })
    );
    qa('[data-unit-toggle]').forEach((chk) =>
      chk.addEventListener('change', () => {
        this.callbacks.onToggleUnit?.(
          chk.dataset.unitToggle,
          chk.dataset.unitName,
          chk.checked
        );
      })
    );
    qa('[data-topic-toggle]').forEach((chip) =>
      chip.addEventListener('click', () => {
        this.callbacks.onToggleTopic?.(
          chip.dataset.topicToggle,
          chip.dataset.unitName,
          chip.dataset.topicName
        );
      })
    );
    qa('[data-export-zip]').forEach((btn) =>
      btn.addEventListener('click', () =>
        this.callbacks.onExportSubjectZip?.(btn.dataset.exportZip)
      )
    );
    qa('[data-edit-subject]').forEach((btn) =>
      btn.addEventListener('click', () =>
        this.callbacks.onEditSubject?.(btn.dataset.editSubject)
      )
    );
    qa('[data-delete-subject]').forEach((btn) =>
      btn.addEventListener('click', () =>
        this.callbacks.onDeleteSubject?.(btn.dataset.deleteSubject)
      )
    );

    // Krillion settings
    qa('[data-direction]').forEach((btn) =>
      btn.addEventListener('click', () =>
        this.callbacks.onChangeSetting?.('promptDirection', btn.dataset.direction)
      )
    );
    qa('[data-rounds]').forEach((btn) =>
      btn.addEventListener('click', () =>
        this.callbacks.onChangeSetting?.('roundsPerDive', Number(btn.dataset.rounds))
      )
    );
    qa('[data-duration]').forEach((btn) =>
      btn.addEventListener('click', () =>
        this.callbacks.onChangeSetting?.('roundDurationSec', Number(btn.dataset.duration))
      )
    );
    qa('[data-companion]').forEach((btn) =>
      btn.addEventListener('click', () =>
        this.callbacks.onChangeSetting?.('companionId', btn.dataset.companion)
      )
    );

    q('#lobby-ai-btn')?.addEventListener('click', () => this.callbacks.onOpenAiModal?.());
    q('#launch-krillion-btn')?.addEventListener('click', () => this.callbacks.onLaunchDive?.());
    q('#launch-wordle-btn')?.addEventListener('click', () => this.callbacks.onLaunchWordle?.());
  }
}
