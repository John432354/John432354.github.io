/**
 * Subject Lab Modal — Upload `.zip`, Create/Edit Subjects (with Multi-Answers,
 * Unit, Topic, & Java-Comment Explanations), Paste `.txt`, & Export `.zip` / `.js`
 */

import { parseVocabTxt } from '../../subjects/txt-parser.js';
import { serializeSubjectToJsModule } from '../cloud/repo-exporter.js';
import { downloadTextFile } from '../cloud/gdrive-helper.js';
import { escapeHtml } from './dom-helpers.js';

const ICON_OPTIONS = ['📚', '🖋️', '🧬', '⚛️', '🌊', '🧠', '💻', '🏛️', '📐', '🧪', '🌍', '🎵'];
const ACCENT_OPTIONS = ['#38f2ff', '#34d399', '#a78bfa', '#fbbf24', '#fb7185', '#60a5fa'];

export class SubjectModal {
  constructor(modalRoot, callbacks = {}) {
    this.modalRoot = modalRoot;
    this.callbacks = callbacks;
    this.activeTab = 'import';
    this.editingSubject = null;
    this.draftCards = [];
  }

  open(mode = 'import', subjectToEdit = null) {
    this.editingSubject = subjectToEdit;
    this.activeTab = subjectToEdit ? 'create' : mode === 'create' ? 'create' : 'import';
    this.draftCards = subjectToEdit
      ? subjectToEdit.cards.map((c) => ({
          termsText: Array.isArray(c.terms) ? c.terms.join(' - ') : c.term,
          definition: c.definition,
          explanation: c.explanation || '',
          unit: c.unit || '',
          topic: c.topic || 'General',
        }))
      : [
          {
            termsText: '',
            definition: '',
            explanation: '',
            unit: '',
            topic: 'General',
          },
          {
            termsText: '',
            definition: '',
            explanation: '',
            unit: '',
            topic: 'General',
          },
        ];

    this.modalRoot.hidden = false;
    this.render();
  }

  close() {
    this.modalRoot.hidden = true;
    this.modalRoot.innerHTML = '';
  }

  render() {
    const subj = this.editingSubject;
    this.modalRoot.innerHTML = `
      <div class="modal-backdrop" id="subj-modal-backdrop">
        <div class="modal-window glass-card" role="dialog" aria-modal="true">
          <div class="modal-head">
            <div>
              <span class="eyebrow-badge">SUBJECT LAB · .ZIP / .TXT / MULTI-ANSWER</span>
              <h2>${subj ? `Edit "${escapeHtml(subj.name)}"` : 'Upload .zip or Create Subject'}</h2>
            </div>
            <button type="button" class="icon-close-btn" id="subj-modal-close">✕</button>
          </div>

          <div class="modal-tabs">
            <button type="button" class="tab-btn ${this.activeTab === 'import' ? 'active' : ''}" data-tab="import">
              📦 Upload Subject .zip / .txt
            </button>
            <button type="button" class="tab-btn ${this.activeTab === 'create' ? 'active' : ''}" data-tab="create">
              ✏️ Card Editor
            </button>
            <button type="button" class="tab-btn ${this.activeTab === 'repo' ? 'active' : ''}" data-tab="repo">
              💾 Export .zip / GitHub .js
            </button>
          </div>

          <div class="modal-body">
            ${this.activeTab === 'import' ? this.renderImportTab() : ''}
            ${this.activeTab === 'create' ? this.renderCreateTab(subj) : ''}
            ${this.activeTab === 'repo' ? this.renderRepoTab() : ''}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderImportTab() {
    return `
      <div class="import-box">
        <div class="zip-dropzone modal-zip-drop" id="modal-zip-drop">
          <input type="file" id="modal-zip-input" accept=".zip,application/zip" multiple hidden />
          <div class="zip-drop-content">
            <span class="zip-drop-icon">📦</span>
            <div>
              <strong>Upload Subject <code>.zip</code> Archive(s)</strong>
              <p>e.g. <code>AP Lang.zip</code> containing <code>Tones Vocab.txt</code> or <code>Unit 1/Tones Vocab.txt</code></p>
            </div>
          </div>
        </div>

        <hr class="modal-divider" />

        <h3 style="font-size:0.95rem">Or Paste / Upload a Single Topic <code>.txt</code> File</h3>
        <p class="muted-sub">
          Supports <code>Term1 - Term2 : Definition // Java comment explanation</code> and <code>/* block comments */</code>.
        </p>

        <div class="form-grid-3">
          <div class="field-block">
            <label>Subject Name</label>
            <input type="text" id="imp-subj-name" placeholder="e.g. AP Lang" />
          </div>
          <div class="field-block">
            <label>Unit (Optional)</label>
            <input type="text" id="imp-unit-name" placeholder="e.g. Unit 1 Rhetoric" />
          </div>
          <div class="field-block">
            <label>Topic Name</label>
            <input type="text" id="imp-topic-name" placeholder="e.g. Tones Vocab" />
          </div>
        </div>

        <div class="field-block">
          <label>Upload <code>.txt</code> / <code>.json</code> File</label>
          <input type="file" id="imp-file" accept=".txt,.tsv,.csv,.json" />
        </div>

        <div class="field-block">
          <label>Paste <code>.txt</code> Lines</label>
          <textarea
            id="imp-paste"
            rows="6"
            placeholder="Acerbic - Caustic - Biting : Sharp and harsh in tone // Common in satire&#10;Didactic : Intended to instruct or moralize"
          ></textarea>
        </div>

        <div class="modal-footer-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="modal-open-spec-btn">
            📖 View Full Format Spec
          </button>
          <button type="button" class="btn btn-primary" id="imp-run-btn">Import Topic Cards</button>
        </div>
      </div>
    `;
  }

  renderCreateTab(subj) {
    return `
      <form id="subject-editor-form" class="subj-form">
        <div class="form-grid-2">
          <div class="field-block">
            <label>Subject Name</label>
            <input
              type="text"
              id="subj-name-input"
              required
              placeholder="e.g., AP Lang"
              value="${escapeHtml(subj?.name || '')}"
            />
          </div>
          <div class="field-block">
            <label>Description</label>
            <input
              type="text"
              id="subj-desc-input"
              placeholder="Units, topics, or exam notes"
              value="${escapeHtml(subj?.description || '')}"
            />
          </div>
        </div>

        <div class="form-grid-2">
          <div class="field-block">
            <label>Icon</label>
            <div class="picker-row" id="subj-icon-picker">
              ${ICON_OPTIONS.map(
                (ic, idx) => `
                  <button
                    type="button"
                    class="pick-chip ${(subj?.icon || ICON_OPTIONS[0]) === ic && (subj || idx === 0) ? 'active' : ''}"
                    data-icon="${ic}"
                  >${ic}</button>
                `
              ).join('')}
            </div>
          </div>

          <div class="field-block">
            <label>Accent Color</label>
            <div class="picker-row" id="subj-accent-picker">
              ${ACCENT_OPTIONS.map(
                (col, idx) => `
                  <button
                    type="button"
                    class="color-dot ${(subj?.accent || ACCENT_OPTIONS[0]) === col && (subj || idx === 0) ? 'active' : ''}"
                    style="background:${col}"
                    data-accent="${col}"
                  ></button>
                `
              ).join('')}
            </div>
          </div>
        </div>

        <div class="cards-editor-head">
          <label>Cards (Separate multiple valid answers with <code> - </code>; optional Unit, Topic &amp; Explanation)</label>
          <button type="button" class="btn btn-secondary btn-sm" id="add-card-row-btn">+ Add Card</button>
        </div>

        <div class="cards-rows-list" id="cards-rows-list">
          ${this.draftCards
            .map(
              (c, idx) => `
              <div class="card-edit-block" data-idx="${idx}">
                <div class="card-edit-top">
                  <span class="row-num">#${idx + 1}</span>
                  <input type="text" class="card-unit-in" placeholder="Unit (optional)" value="${escapeHtml(
                    c.unit
                  )}" />
                  <input type="text" class="card-topic-in" placeholder="Topic (e.g. Tones Vocab)" value="${escapeHtml(
                    c.topic
                  )}" />
                  <button type="button" class="row-del-btn" data-del-row="${idx}" title="Remove">✕</button>
                </div>
                <div class="card-edit-mid">
                  <input
                    type="text"
                    class="card-term-in"
                    placeholder="Valid Answer(s): e.g. Acerbic - Caustic - Biting"
                    value="${escapeHtml(c.termsText)}"
                  />
                  <input
                    type="text"
                    class="card-def-in"
                    placeholder="Definition clue"
                    value="${escapeHtml(c.definition)}"
                  />
                </div>
                <input
                  type="text"
                  class="card-expl-in"
                  placeholder="// Optional end-of-question explanation"
                  value="${escapeHtml(c.explanation)}"
                />
              </div>
            `
            )
            .join('')}
        </div>

        <div class="modal-footer-actions">
          <button type="button" class="btn btn-secondary" id="subj-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Subject (${this.draftCards.length} rows)</button>
        </div>
      </form>
    `;
  }

  renderRepoTab() {
    const subjects = this.callbacks.getAllSubjects?.() || [];
    return `
      <div class="repo-export-box">
        <p class="muted-sub">
          Export any Subject back into a clean <code>&lt;Subject&gt;.zip</code> archive (preserving
          <code>&lt;Unit&gt;/&lt;Topic&gt;.txt</code> folders, <code>-</code> multi-answers, and <code>//</code> explanations)
          for Google Drive sharing, OR export as <code>subjects/&lt;slug&gt;.js</code> for <code>github.io</code>.
        </p>

        ${
          subjects.length === 0
            ? `<p class="empty-inline">No subjects created yet — upload a <code>.zip</code> first.</p>`
            : `<div class="export-subj-list">
                ${subjects
                  .map(
                    (s) => `
                    <div class="export-subj-item">
                      <span>${escapeHtml(s.icon)} <strong>${escapeHtml(s.name)}</strong> (${s.cards.length} terms)</span>
                      <div class="export-actions">
                        <button type="button" class="btn btn-primary btn-sm" data-dl-zip="${escapeHtml(s.id)}">
                          ⬇ Export "${escapeHtml(s.name)}.zip"
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" data-dl-js="${escapeHtml(s.id)}">
                          ⬇ .js Module
                        </button>
                      </div>
                    </div>
                  `
                  )
                  .join('')}
              </div>`
        }
      </div>
    `;
  }

  syncDraftRowsFromDom() {
    const blocks = this.modalRoot.querySelectorAll('.card-edit-block');
    if (!blocks.length) return;
    this.draftCards = Array.from(blocks).map((b) => ({
      unit: b.querySelector('.card-unit-in')?.value || '',
      topic: b.querySelector('.card-topic-in')?.value || 'General',
      termsText: b.querySelector('.card-term-in')?.value || '',
      definition: b.querySelector('.card-def-in')?.value || '',
      explanation: b.querySelector('.card-expl-in')?.value || '',
    }));
  }

  bindEvents() {
    const q = (sel) => this.modalRoot.querySelector(sel);
    const qa = (sel) => this.modalRoot.querySelectorAll(sel);

    q('#subj-modal-close')?.addEventListener('click', () => this.close());
    q('#subj-cancel-btn')?.addEventListener('click', () => this.close());
    q('#subj-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'subj-modal-backdrop') this.close();
    });

    qa('[data-tab]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.syncDraftRowsFromDom();
        this.activeTab = btn.dataset.tab;
        this.render();
      })
    );

    // ZIP upload inside modal
    const modalZipDrop = q('#modal-zip-drop');
    const modalZipInput = q('#modal-zip-input');
    modalZipDrop?.addEventListener('click', () => modalZipInput?.click());
    modalZipDrop?.addEventListener('dragover', (e) => {
      e.preventDefault();
      modalZipDrop.classList.add('drag-active');
    });
    modalZipDrop?.addEventListener('dragleave', () => modalZipDrop.classList.remove('drag-active'));
    modalZipDrop?.addEventListener('drop', (e) => {
      e.preventDefault();
      modalZipDrop.classList.remove('drag-active');
      const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
        f.name.toLowerCase().endsWith('.zip')
      );
      if (files.length > 0) {
        this.callbacks.onUploadZipFiles?.(files);
        this.close();
      }
    });
    modalZipInput?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        this.callbacks.onUploadZipFiles?.(files);
        this.close();
      }
    });

    q('#modal-open-spec-btn')?.addEventListener('click', () => {
      this.close();
      this.callbacks.onOpenSpec?.();
    });

    // Picker chips
    qa('[data-icon]').forEach((btn) =>
      btn.addEventListener('click', () => {
        qa('[data-icon]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      })
    );
    qa('[data-accent]').forEach((btn) =>
      btn.addEventListener('click', () => {
        qa('[data-accent]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      })
    );

    q('#add-card-row-btn')?.addEventListener('click', () => {
      this.syncDraftRowsFromDom();
      const last = this.draftCards[this.draftCards.length - 1];
      this.draftCards.push({
        termsText: '',
        definition: '',
        explanation: '',
        unit: last?.unit || '',
        topic: last?.topic || 'General',
      });
      this.render();
    });

    qa('[data-del-row]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.syncDraftRowsFromDom();
        const idx = Number(btn.dataset.delRow);
        if (this.draftCards.length > 1) {
          this.draftCards.splice(idx, 1);
          this.render();
        }
      })
    );

    q('#subject-editor-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.syncDraftRowsFromDom();
      const name = q('#subj-name-input')?.value?.trim();
      const description = q('#subj-desc-input')?.value?.trim() || '';
      const icon = q('#subj-icon-picker .active')?.dataset.icon || '📚';
      const accent = q('#subj-accent-picker .active')?.dataset.accent || '#38f2ff';

      const validCards = this.draftCards
        .map((row) => {
          const parsed = parseVocabTxt(`${row.termsText} : ${row.definition}`);
          const terms = parsed[0]?.terms || [row.termsText.trim()].filter(Boolean);
          return {
            terms,
            term: terms.join(' - '),
            definition: row.definition.trim(),
            explanation: row.explanation.trim(),
            unit: row.unit.trim(),
            topic: row.topic.trim() || 'General',
          };
        })
        .filter((c) => c.terms.length > 0 && c.definition);

      if (!name || validCards.length === 0) {
        alert('Please enter a subject name and at least 1 valid card.');
        return;
      }

      this.callbacks.onSaveSubject?.({
        id: this.editingSubject?.id,
        name,
        description,
        icon,
        accent,
        cards: validCards,
      });
      this.close();
    });

    // Single .txt file upload or paste
    q('#imp-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const pasteEl = q('#imp-paste');
      const topicEl = q('#imp-topic-name');
      const subjEl = q('#imp-subj-name');
      if (topicEl && !topicEl.value) {
        topicEl.value = file.name.replace(/\.[^.]+$/, '');
      }
      if (subjEl && !subjEl.value) {
        subjEl.value = file.name.replace(/\.[^.]+$/, '');
      }
      if (pasteEl) pasteEl.value = text;
    });

    q('#imp-run-btn')?.addEventListener('click', () => {
      const raw = q('#imp-paste')?.value?.trim() || '';
      const name = q('#imp-subj-name')?.value?.trim() || 'Imported Subject';
      const unit = q('#imp-unit-name')?.value?.trim() || '';
      const topic = q('#imp-topic-name')?.value?.trim() || 'General';
      if (!raw) return;

      let cards = [];
      if (raw.startsWith('{') || raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          cards = Array.isArray(parsed) ? parsed : parsed.cards || [];
        } catch {
          alert('Invalid JSON.');
          return;
        }
      } else {
        cards = parseVocabTxt(raw, { unit, topic });
      }

      if (cards.length === 0) {
        alert('No valid Term : Definition lines found.');
        return;
      }

      this.callbacks.onSaveSubject?.({
        name,
        description: `${topic}${unit ? ` (${unit})` : ''} · ${cards.length} terms`,
        icon: '📚',
        accent: '#38f2ff',
        cards,
      });
      this.close();
    });

    // Export .zip or .js
    qa('[data-dl-zip]').forEach((btn) =>
      btn.addEventListener('click', () => {
        this.callbacks.onExportSubjectZip?.(btn.dataset.dlZip);
      })
    );
    qa('[data-dl-js]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const subjects = this.callbacks.getAllSubjects?.() || [];
        const found = subjects.find((s) => s.id === btn.dataset.dlJs);
        if (!found) return;
        const exp = serializeSubjectToJsModule(found);
        downloadTextFile(exp.filename, exp.code, 'text/javascript;charset=utf-8');
      })
    );
  }
}
