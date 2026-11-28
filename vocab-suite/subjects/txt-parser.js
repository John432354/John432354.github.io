/**
 * Vocab `.txt` Parser & Serializer
 *
 * Supports:
 * 1. Single or multiple `-`-separated valid answers:
 *      Acerbic - Caustic - Biting : Sharp and forthright in tone
 *    (Use `\-` inside a term if a literal hyphen is needed, e.g. ` Avant\-Garde : Experimental `)
 * 2. Optional Explanations written as standard Java code comments (`// ...` or `/* ... * /`):
 *    - Inline at the end of an entry line:
 *        Didactic - Moralizing : Intended to teach // Often carries a patronizing connotation
 *    - Or on immediately following comment line(s) beneath an entry:
 *        Elegiac : Mournful or nostalgic in tone
 *        // Common in poetry lamenting the past
 *        /* Watch for imagery of autumn, dusk, or loss * /
 */

import { createId } from './schema.js';

const ESCAPED_HYPHEN_TOKEN = '\uE000HYPHEN\uE000';

/**
 * Splits multiple valid answers separated by `-` dashes while preserving `\-` escapes.
 */
export function splitDashAnswers(rawLeft) {
  const safe = String(rawLeft ?? '').replace(/\\-/g, ESCAPED_HYPHEN_TOKEN);
  return safe
    .split(/\s*-\s*/)
    .map((part) => part.replaceAll(ESCAPED_HYPHEN_TOKEN, '-').trim())
    .filter(Boolean);
}

/**
 * Splits an entry line (with comments already stripped) into `{ rawTerms, rawDefinition }`.
 * Priority: `::`, `\t`, ` = `, `:`.
 */
function splitTermAndDefinition(cleanLine) {
  const doubleColon = cleanLine.indexOf('::');
  if (doubleColon > 0) {
    return {
      rawTerms: cleanLine.slice(0, doubleColon).trim(),
      rawDefinition: cleanLine.slice(doubleColon + 2).trim(),
    };
  }

  const tabIdx = cleanLine.indexOf('\t');
  if (tabIdx > 0) {
    return {
      rawTerms: cleanLine.slice(0, tabIdx).trim(),
      rawDefinition: cleanLine.slice(tabIdx + 1).trim(),
    };
  }

  const eqIdx = cleanLine.indexOf(' = ');
  if (eqIdx > 0) {
    return {
      rawTerms: cleanLine.slice(0, eqIdx).trim(),
      rawDefinition: cleanLine.slice(eqIdx + 3).trim(),
    };
  }

  // Match first `:` that is NOT part of `http://` or `https://`
  const colonMatch = cleanLine.match(/^(.+?):(?![/]{2})(.*)$/);
  if (colonMatch) {
    return {
      rawTerms: colonMatch[1].trim(),
      rawDefinition: colonMatch[2].trim(),
    };
  }

  return null;
}

function cleanBlockCommentText(rawComment) {
  return rawComment
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\* ?/, '').trim())
    .filter(Boolean)
    .join(' ');
}

function extractInlineJavaComment(line) {
  // Check for inline /* ... */ on same line
  let working = line;
  const extracted = [];

  working = working.replace(/\/\*([\s\S]*?)\*\//g, (_, inner) => {
    const cleaned = cleanBlockCommentText(inner);
    if (cleaned) extracted.push(cleaned);
    return '';
  });

  // Check for inline // ... (ignoring :// in URLs)
  const slashIdx = findUnescapedLineComment(working);
  if (slashIdx >= 0) {
    const commentPart = working.slice(slashIdx + 2).trim();
    if (commentPart) extracted.push(commentPart);
    working = working.slice(0, slashIdx);
  }

  return {
    codePart: working.trim(),
    inlineExplanation: extracted.join(' ').trim(),
  };
}

function findUnescapedLineComment(str) {
  for (let i = 0; i < str.length - 1; i += 1) {
    if (str[i] === '/' && str[i + 1] === '/') {
      if (i > 0 && str[i - 1] === ':') continue; // keep https://
      return i;
    }
  }
  return -1;
}

/**
 * Parses a full `.txt` Topic vocabulary file into normalized card objects.
 */
export function parseTopicTxtContent(text, { unit = '', topic = 'Vocabulary' } = {}) {
  const src = String(text ?? '').replace(/^\uFEFF/, ''); // strip UTF-8 BOM if present
  const lines = src.split(/\r?\n/);
  const cards = [];

  let currentCard = null;
  let inBlockComment = false;
  let blockBuffer = [];

  const appendExplanationToCurrent = (note) => {
    const clean = String(note ?? '').trim();
    if (!clean || !currentCard) return;
    currentCard.explanation = currentCard.explanation
      ? `${currentCard.explanation} ${clean}`
      : clean;
  };

  for (let i = 0; i < lines.length; i += 1) {
    let rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (inBlockComment) {
      const endIdx = trimmed.indexOf('*/');
      if (endIdx >= 0) {
        blockBuffer.push(trimmed.slice(0, endIdx));
        appendExplanationToCurrent(cleanBlockCommentText(blockBuffer.join('\n')));
        blockBuffer = [];
        inBlockComment = false;
        const remainder = trimmed.slice(endIdx + 2).trim();
        if (!remainder) continue;
        rawLine = remainder;
      } else {
        blockBuffer.push(trimmed);
        continue;
      }
    }

    if (!rawLine.trim()) continue;

    // Pure single-line Java comment `// ...`
    if (rawLine.trim().startsWith('//')) {
      const note = rawLine.trim().replace(/^\/\/+\s*/, '');
      appendExplanationToCurrent(note);
      continue;
    }

    // Pure or multi-line Java block comment `/* ...`
    if (rawLine.trim().startsWith('/*')) {
      const afterStart = rawLine.trim().slice(2);
      const closeIdx = afterStart.indexOf('*/');
      if (closeIdx >= 0) {
        appendExplanationToCurrent(cleanBlockCommentText(afterStart.slice(0, closeIdx)));
      } else {
        inBlockComment = true;
        blockBuffer = [afterStart];
      }
      continue;
    }

    // Standard vocab entry line (with optional trailing `//` or `/* */` comment)
    const { codePart, inlineExplanation } = extractInlineJavaComment(rawLine);

    // Check if an unclosed `/*` started at the end of this entry line
    let openBlockTail = '';
    const unclosedIdx = codePart.indexOf('/*');
    let finalCode = codePart;
    if (unclosedIdx >= 0) {
      openBlockTail = codePart.slice(unclosedIdx + 2);
      finalCode = codePart.slice(0, unclosedIdx).trim();
      inBlockComment = true;
      blockBuffer = [openBlockTail];
    }

    const split = splitTermAndDefinition(finalCode);
    if (!split) continue;

    const terms = splitDashAnswers(split.rawTerms);
    const definition = split.rawDefinition.trim();
    if (terms.length === 0 || !definition) continue;

    currentCard = {
      id: createId(`card_${cards.length}`),
      terms,
      term: terms.join(' - '),
      definition,
      explanation: inlineExplanation || '',
      unit: String(unit || '').trim(),
      topic: String(topic || 'General').trim(),
    };
    cards.push(currentCard);
  }

  return cards;
}

/**
 * Serializes cards back into the standard `.txt` format with `-` answers & `//` explanations.
 */
export function serializeCardsToTxt(cards = [], headerTitle = '') {
  const lines = [];
  if (headerTitle) {
    lines.push(`// ${headerTitle}`);
    lines.push('');
  }
  for (const c of cards) {
    const termsArr = Array.isArray(c.terms) && c.terms.length > 0 ? c.terms : [c.term];
    const escapedTerms = termsArr
      .map((t) => String(t ?? '').trim().replace(/-/g, '\\-'))
      .filter(Boolean)
      .join(' - ');
    const base = `${escapedTerms} : ${String(c.definition ?? '').trim()}`;
    if (c.explanation && String(c.explanation).trim()) {
      lines.push(`${base} // ${String(c.explanation).replace(/\r?\n/g, ' ').trim()}`);
    } else {
      lines.push(base);
    }
  }
  return `${lines.join('\n')}\n`;
}

export const parseVocabTxt = parseTopicTxtContent;

