/**
 * Emoji -> inline SVG icon upgrade
 * ---------------------------------------------------------------------------
 * The upstream suite writes emoji straight into its templates. Emoji render as
 * tofu boxes wherever no emoji font is installed (headless Chrome, many Linux
 * and Windows setups), so every glyph the UI depends on is swapped for a
 * mask-image SVG from `styles/11-icons.css`.
 *
 * Runs as a MutationObserver so re-rendered views are upgraded too, and skips
 * <script>/<style>/<code>/<pre> so documentation examples keep their literal
 * characters.
 */

const ICON_MAP = [
  ['🦐', 'vs-i-brand'],
  ['📦', 'vs-i-box'],
  ['📖', 'vs-i-book'],
  ['⚡', 'vs-i-bolt'],
  ['🔊', 'vs-i-sound'],
  ['🔇', 'vs-i-mute'],
  ['🌊', 'vs-i-wave'],
  ['🟩', 'vs-i-grid'],
  ['🏳️', 'vs-i-flag'],
  ['🏳', 'vs-i-flag'],
  ['⏭', 'vs-i-skip'],
  ['♾️', 'vs-i-unlimited'],
  ['♾', 'vs-i-unlimited'],
  ['🚫', 'vs-i-ban'],
  ['🔀', 'vs-i-shuffle'],
  ['⏳', 'vs-i-hourglass'],
  ['📡', 'vs-i-radar'],
  ['🗑️', 'vs-i-trash'],
  ['🗑', 'vs-i-trash'],
  ['✓', 'vs-i-check'],
  // --- glyphs introduced by the subject picker / remaining panels ---
  ['📚', 'vs-i-stack'],
  ['📄', 'vs-i-page'],
  ['📁', 'vs-i-folder'],
  ['📐', 'vs-i-ruler'],
  ['💡', 'vs-i-bulb'],
  ['💾', 'vs-i-save'],
  ['🖋', 'vs-i-pen'],
  ['✏', 'vs-i-pen'],
  ['🎯', 'vs-i-target'],
  ['⌫', 'vs-i-backspace'],
  ['⏎', 'vs-i-enter'],
  ['▶', 'vs-i-play'],
  ['⏱', 'vs-i-timer'],
  ['🪼', 'vs-i-jelly'],
  ['🚤', 'vs-i-boat'],
  ['🌍', 'vs-i-globe'],
  ['🧠', 'vs-i-brain'],
  ['💻', 'vs-i-laptop'],
  ['🧬', 'vs-i-dna'],
  ['⚛', 'vs-i-atom'],
  ['🧪', 'vs-i-flask'],
  ['🏛', 'vs-i-bank'],
  ['🎵', 'vs-i-note'],
  // Directional arrows live in prose as well as buttons; they read fine in
  // every font we care about, so they are deliberately left alone.
];

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT']);
// Longest-first so 🏳️ wins over 🏳 and ♾️ over ♾
const SORTED = [...ICON_MAP].sort((a, b) => b[0].length - a[0].length);

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Every mapped emoji, optionally followed by U+FE0F (emoji presentation
// selector). Templates are inconsistent: some write 📖, others 📖️, so both
// have to match or the leftover selector renders as its own tofu box.
const EMOJI_RE = new RegExp(
  '(' + SORTED.map(([e]) => escapeRe(e)).join('|') + ')[\uFE0F\uFE0E]?',
  'g'
);

// Map a matched token (emoji, possibly + selector) back to its class
function classForToken(token) {
  const bare = token.replace(/[\uFE0F\uFE0E]/g, '');
  return SORTED.find(([e]) => e.replace(/[\uFE0F\uFE0E]/g, '') === bare)?.[1] || 'vs-i-box';
}

function buildIconSpan(emoji) {
  const cls = classForToken(emoji);
  const span = document.createElement('span');
  span.className = `vs-icon ${cls}`;
  span.setAttribute('aria-hidden', 'true');
  // Keep the literal emoji as the accessible/fallback text; CSS sets font-size:0
  span.textContent = emoji;
  return span;
}

function upgradeTextNode(node) {
  const text = node.nodeValue;
  if (!text || !EMOJI_RE.test(text)) {
    EMOJI_RE.lastIndex = 0;
    return;
  }
  EMOJI_RE.lastIndex = 0;

  const frag = document.createDocumentFragment();
  let last = 0;
  let m;
  while ((m = EMOJI_RE.exec(text)) !== null) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    frag.appendChild(buildIconSpan(m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  node.parentNode.replaceChild(frag, node);
}

function upgradeElement(el) {
  if (el.nodeType === Node.TEXT_NODE) {
    if (!el.parentElement || SKIP_TAGS.has(el.parentElement.tagName)) return;
    if (el.parentElement.classList.contains('vs-icon')) return;
    upgradeTextNode(el);
    return;
  }
  if (el.nodeType !== Node.ELEMENT_NODE) return;
  if (SKIP_TAGS.has(el.tagName)) return;

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !EMOJI_RE.test(n.nodeValue)) {
        EMOJI_RE.lastIndex = 0;
        return NodeFilter.FILTER_REJECT;
      }
      EMOJI_RE.lastIndex = 0;
      if (!n.parentElement || SKIP_TAGS.has(n.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
      if (n.parentElement.classList.contains('vs-icon')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);
  // Replace after walking: mutating during traversal invalidates the walker
  targets.forEach(upgradeTextNode);
}

function upgradeAll(root = document.body) {
  if (!root) return;
  upgradeElement(root);
}

let scheduled = false;
function scheduleUpgrade() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    upgradeAll(document.body);
  });
}

export function initIconUpgrade() {
  upgradeAll(document.body);
  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
          scheduleUpgrade();
          return;
        }
      }
      // Character-data edits (text swaps inside existing nodes)
      if (rec.type === 'characterData') {
        scheduleUpgrade();
        return;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return observer;
}
