/**
 * Full On-Page Creator Format & Subject `.zip` Specification View
 *
 * Gives students and teachers a crystal-clear, interactive specification on the page
 * for authoring their own `<Subject>.zip` archives, optional `<Unit>/` folders,
 * `<Topic>.txt` vocabulary files, `-`-separated valid answers, and Java code comment
 * (`// ...` and `/* ... *\/`) explanations — plus a live interactive `.txt` tester
 * and 1-click Sample `AP Lang.zip` download/import!
 */

import { parseVocabTxt } from '../../subjects/txt-parser.js';
import { escapeHtml } from './dom-helpers.js';

const DEFAULT_PLAYGROUND_TXT = `// Try editing these lines live! Java comments attach as end-of-question explanations.

Acerbic - Caustic - Biting : Sharp, harsh, and cutting in tone // Derived from Latin "acerbus" (sour/bitter); common in satirical AP Lang passages.

/* Multi-line Java block comments also work!
   Great for etymology, historical context, or common exam traps. */
Didactic - Preachy : Intended to teach or instruct, especially with heavy moralizing

X\\-Ray Crystallography : Imaging technique that determines atomic molecular structure
// Use \\- (backslash-dash) whenever a single term contains a literal hyphen!`;

export class CreatorSpecView {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.playgroundTxt = DEFAULT_PLAYGROUND_TXT;
  }

  render() {
    this.container.innerHTML = `
      <section class="spec-shell">
        <!-- Hero Banner -->
        <header class="spec-hero glass-card">
          <div class="spec-hero-top">
            <div>
              <span class="eyebrow-badge">OFFICIAL CREATOR SPECIFICATION · v2.0</span>
              <h1>How to Build Your Own Subject <code>.zip</code> &amp; Topic <code>.txt</code> Sets</h1>
              <p>
                Every vocabulary file you create works automatically across <strong>both games</strong> in the suite:
                <strong>Krillion</strong> (Speed-Depth + 3-Pass Kev-0.6B AI) and
                <strong>Vocab Wordle</strong> (Unlimited Tries + Simultaneous Multi-Answer Boards).
              </p>
            </div>
            <div class="spec-hero-actions">
              <button type="button" class="btn btn-primary" id="spec-download-sample-btn">
                ⬇ Download Sample "AP Lang.zip"
              </button>
              <button type="button" class="btn btn-secondary" id="spec-load-sample-btn">
                ⚡ Load Sample "AP Lang.zip" Into Suite
              </button>
              <button type="button" class="btn btn-secondary" id="spec-back-hub-btn">
                ← Back to Suite Hub
              </button>
            </div>
          </div>
        </header>

        <!-- Grid: Section 1 (ZIP Structure) + Section 2 (.txt Line Grammar) -->
        <div class="spec-two-col">
          <article class="glass-card spec-card">
            <span class="eyebrow-badge">1 · ZIP ARCHIVE &amp; FOLDER HIERARCHY</span>
            <h2>Subject <code>.zip</code> → Optional Unit Folders → Topic <code>.txt</code></h2>
            <p class="spec-p">
              Name your <code>.zip</code> file after the <strong>Subject</strong>. Inside the archive,
              each <code>.txt</code> file becomes a selectable <strong>Topic</strong>. Place <code>.txt</code> files
              inside subfolders whenever you want an optional <strong>Unit</strong> breakdown!
            </p>

            <div class="spec-code-label">Option A — With Unit Folders (Recommended for Courses)</div>
            <pre class="spec-pre"><code>AP Lang.zip               = Subject "AP Lang"
 |
 +-- Unit 1 Rhetoric/     = Unit
 |    |
 |    +-- Tones Vocab.txt    = Topic
 |    +-- Appeals &amp; Syntax.txt = Topic
 |
 +-- Unit 2 Fallacies/       = Unit
      |
      +-- Logical Fallacies.txt = Topic</code></pre>

            <div class="spec-code-label">Option B — Flat Archive (No Units Needed)</div>
            <pre class="spec-pre"><code>AP Lang.zip              = Subject "AP Lang"
 |
 +-- Tones Vocab.txt     = Topic
 +-- Rhetorical Devices.txt = Topic</code></pre>

            <ul class="spec-rules-list">
              <li><strong>macOS &amp; Windows friendly:</strong> If zipping a folder creates a single outer wrapper folder (e.g. <code>AP Lang.zip/AP Lang/Unit 1/...</code>), the importer automatically unwraps it and ignores <code>__MACOSX</code> and <code>.DS_Store</code>.</li>
              <li><strong>Selective filtering:</strong> In the Suite Hub, you can toggle individual Units or Topics on and off before starting either game.</li>
            </ul>
          </article>

          <article class="glass-card spec-card">
            <span class="eyebrow-badge">2 · TOPIC .TXT GRAMMAR &amp; MULTI-ANSWERS</span>
            <h2>One Card Per Line + <code>-</code> Dash Multiple Answers</h2>
            <p class="spec-p">
              Inside each <code>.txt</code> file, write one vocabulary entry per line using a colon
              (<code>:</code>), equals sign (<code>=</code>), or <code>Tab</code> between the answer term(s) and definition.
            </p>

            <div class="spec-code-label">Basic Single-Answer Line</div>
            <pre class="spec-pre"><code>Zeugma : One verb governing two nouns in different senses</code></pre>

            <div class="spec-code-label">Multiple Valid Answers Separated by <code>-</code> Dashes</div>
            <pre class="spec-pre"><code>Acerbic - Caustic - Biting : Sharp, harsh, and cutting in tone
Ad Hominem - Personal Attack : Attacking the speaker rather than the claim</code></pre>

            <div class="spec-code-label">Escaping a Literal Hyphen Inside a Single Term (<code>\\-</code>)</div>
            <pre class="spec-pre"><code>Half\\-Life : Time required for half of a radioactive sample to decay
Post\\-Hoc - Post\\-Hoc Fallacy : Assuming sequence implies causation</code></pre>

            <ul class="spec-rules-list">
              <li><strong>In Krillion:</strong> Submitting <em>any</em> of the <code>-</code>-separated valid answers (or a close paraphrase verified by 3-pass Kev-0.6B) earns full speed-based depth, and all stored answers are shown on reveal.</li>
              <li><strong>In Vocab Wordle:</strong> Every <code>-</code>-separated answer opens its own simultaneous Wordle board! Typing guesses updates matching boards at once, and solving <strong>any single answer</strong> wins the question.</li>
            </ul>
          </article>
        </div>

        <!-- Section 3: Java Code Comment Explanations -->
        <article class="glass-card spec-card">
          <span class="eyebrow-badge">3 · OPTIONAL JAVA-COMMENT EXPLANATIONS</span>
          <h2>Add End-of-Question Explanations Using <code>//</code> or <code>/* ... */</code></h2>
          <p class="spec-p">
            Want to display etymology, exam tips, memory hooks, or examples after a question ends?
            Write them as standard <strong>Java code comments</strong>! Standalone comments before a card,
            inline trailing comments on the card line, or trailing comments immediately below a card all work.
          </p>

          <div class="spec-three-examples">
            <div>
              <div class="spec-code-label">Style 1 — Inline Trailing <code>//</code></div>
              <pre class="spec-pre"><code>Litotes : Understatement negating its opposite // e.g., "Not bad at all!"</code></pre>
            </div>
            <div>
              <div class="spec-code-label">Style 2 — Standalone <code>//</code> Line(s)</div>
              <pre class="spec-pre"><code>// Contrast with hyperbole; common in British irony.
Meiosis - Understatement : Deliberate downplaying</code></pre>
            </div>
            <div>
              <div class="spec-code-label">Style 3 — Multi-Line <code>/* ... */</code> Block</div>
              <pre class="spec-pre"><code>/* From Greek "paraleipein" (to leave aside).
   Example: "I won't mention my opponent's tax record..." */
Paralipsis - Apophasis : Mentioning by claiming not to</code></pre>
            </div>
          </div>

          <p class="spec-note-callout">
            💡 <strong>Standalone file headers:</strong> Put a blank line after any top-of-file comment
            (e.g. <code>// AP Lang Unit 1 Notes</code> followed by an empty line) if you want a file header comment that does <em>not</em> attach to the first vocab term!
          </p>
        </article>

        <!-- Section 4: Game Comparison Matrix -->
        <article class="glass-card spec-card">
          <span class="eyebrow-badge">4 · SUITE BEHAVIOR MATRIX</span>
          <h2>How Both Games Use Your Uploaded <code>.zip</code> / <code>.txt</code> Files</h2>
          <div class="spec-table-wrap">
            <table class="spec-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>🌊 Game 1: Krillion</th>
                  <th>🟩 Game 2: Vocab Wordle</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Answer Judging</strong></td>
                  <td>Browser <code>kev-0.6b-ONNX</code> 3-pass averaged probability against threshold</td>
                  <td>100% deterministic Wordle tile coloring (<strong>zero AI correction</strong>)</td>
                </tr>
                <tr>
                  <td><strong>Tries &amp; Scoring</strong></td>
                  <td>Single shot against round clock; faster = deeper descent (up to 1,000 m/round)</td>
                  <td><strong>Unlimited tries</strong> per question; win streak &amp; solve tracking</td>
                </tr>
                <tr>
                  <td><strong>Multiple <code>-</code> Answers</strong></td>
                  <td>Any valid answer accepted; all valid stored answers displayed after round</td>
                  <td>Simultaneous side-by-side boards — work on all at once &amp; solve <strong>any 1</strong> to win</td>
                </tr>
                <tr>
                  <td><strong>Give Up / Skip Lock</strong></td>
                  <td><strong>Give Up</strong> reveals stored answer &amp; locks Next for the <em>remaining round clock</em></td>
                  <td><strong>Skip</strong> reveals stored answer &amp; locks Next for a <em>dynamic cooldown scaled to answer length</em></td>
                </tr>
                <tr>
                  <td><strong><code>//</code> &amp; <code>/* */</code> Explanations</strong></td>
                  <td>Displayed on the round reveal card &amp; post-dive logbook</td>
                  <td>Displayed in the end-of-question answer banner (and factored into skip reading time)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <!-- Section 5: Live Interactive .txt Parser Playground -->
        <article class="glass-card spec-card">
          <div class="spec-playground-head">
            <div>
              <span class="eyebrow-badge">5 · LIVE INTERACTIVE PARSER SANDBOX</span>
              <h2>Test Your <code>.txt</code> Syntax Right Here</h2>
              <p class="spec-p">Type or paste lines below to verify how multi-answers (<code>-</code>), escaped hyphens (<code>\\-</code>), and Java comments (<code>//</code>, <code>/* */</code>) parse in real time.</p>
            </div>
          </div>

          <div class="spec-playground-grid">
            <div class="field-block">
              <label for="spec-live-textarea">Sample <code>Topic.txt</code> Input</label>
              <textarea id="spec-live-textarea" rows="11" spellcheck="false">${escapeHtml(
                this.playgroundTxt
              )}</textarea>
            </div>
            <div class="field-block">
              <label>Live Parsed Cards Output</label>
              <div class="spec-parsed-preview" id="spec-parsed-output"></div>
            </div>
          </div>
        </article>
      </section>
    `;

    this.updatePlaygroundPreview();

    const textarea = this.container.querySelector('#spec-live-textarea');
    textarea?.addEventListener('input', () => {
      this.playgroundTxt = textarea.value;
      this.updatePlaygroundPreview();
    });

    this.container.querySelector('#spec-download-sample-btn')?.addEventListener('click', () => {
      this.callbacks.onDownloadSampleZip?.();
    });
    this.container.querySelector('#spec-load-sample-btn')?.addEventListener('click', () => {
      this.callbacks.onLoadSampleZip?.();
    });
    this.container.querySelector('#spec-back-hub-btn')?.addEventListener('click', () => {
      this.callbacks.onBackToHub?.();
    });
  }

  updatePlaygroundPreview() {
    const outEl = this.container.querySelector('#spec-parsed-output');
    if (!outEl) return;

    const cards = parseVocabTxt(this.playgroundTxt);
    if (cards.length === 0) {
      outEl.innerHTML = `<p class="muted-empty-row">No valid <code>Term : Definition</code> lines detected yet.</p>`;
      return;
    }

    outEl.innerHTML = cards
      .map(
        (c, idx) => `
        <div class="parsed-card-item">
          <div class="parsed-card-top">
            <span class="round-counter">CARD #${idx + 1}</span>
            <span class="muted-sub">${c.terms.length} valid answer${c.terms.length > 1 ? 's' : ''}</span>
          </div>
          <div class="stored-answer-badges" style="margin:6px 0">
            ${c.terms.map((t) => `<span class="real-ans-chip">${escapeHtml(t)}</span>`).join('')}
          </div>
          <p class="parsed-def"><strong>Definition:</strong> ${escapeHtml(c.definition)}</p>
          ${
            c.explanation
              ? `<p class="parsed-expl"><strong>// Explanation:</strong> ${escapeHtml(c.explanation)}</p>`
              : `<p class="muted-sub" style="font-size:0.75rem">No Java-comment explanation attached</p>`
          }
        </div>
      `
      )
      .join('');
  }
}
