/**
 * Subject, Unit, Topic & Multi-Answer Card Schema
 */

import { parseTopicTxtContent, splitDashAnswers } from './txt-parser.js';

export function createId(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function normalizeCard(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;

  let terms = [];
  if (Array.isArray(raw.terms) && raw.terms.length > 0) {
    terms = raw.terms.map((t) => String(t ?? '').trim()).filter(Boolean);
  } else if (typeof raw.term === 'string' && raw.term.trim()) {
    terms = splitDashAnswers(raw.term);
  }

  const definition = String(raw.definition ?? '').trim();
  if (terms.length === 0 || !definition) return null;

  return {
    id: String(raw.id || createId(`card_${index}`)),
    terms,
    term: terms.join(' - '),
    definition,
    explanation: String(raw.explanation ?? '').trim(),
    unit: String(raw.unit ?? '').trim(),
    topic: String(raw.topic ?? 'General').trim() || 'General',
  };
}

export function normalizeSubject(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Subject must be an object.');
  }
  const name = String(raw.name ?? '').trim();
  if (!name) {
    throw new Error('Subject requires a non-empty name.');
  }

  const rawCards = Array.isArray(raw.cards) ? raw.cards : [];
  const cards = rawCards.map((c, idx) => normalizeCard(c, idx)).filter(Boolean);

  return {
    id: String(raw.id || createId('subj')),
    name,
    description: String(raw.description ?? '').trim(),
    icon: String(raw.icon ?? '📚').trim() || '📚',
    accent: String(raw.accent ?? '#38f2ff').trim() || '#38f2ff',
    builtIn: Boolean(raw.builtIn),
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Date.now(),
    cards,
  };
}

/**
 * Groups a subject's cards into `{ units: Map<unitName, Map<topicName, Card[]>> }`
 * for clean hierarchical Unit -> Topic UI breakdown.
 */
export function buildSubjectHierarchy(subject) {
  const unitMap = new Map();
  for (const card of subject?.cards || []) {
    const unitKey = card.unit || ''; // '' = Root / Ungrouped Topics
    const topicKey = card.topic || 'General';
    if (!unitMap.has(unitKey)) {
      unitMap.set(unitKey, new Map());
    }
    const topicMap = unitMap.get(unitKey);
    if (!topicMap.has(topicKey)) {
      topicMap.set(topicKey, []);
    }
    topicMap.get(topicKey).push(card);
  }
  return unitMap;
}

export function buildSubjectHierarchyList(subject) {
  const unitMap = buildSubjectHierarchy(subject);
  const list = [];
  for (const [unit, topicMap] of unitMap.entries()) {
    const topics = [];
    for (const [topic, cards] of topicMap.entries()) {
      topics.push({ topic, count: cards.length, cards });
    }
    list.push({ unit, topics });
  }
  return list;
}

export function parseBulkTermsText(text, meta = {}) {
  return parseTopicTxtContent(text, meta);
}
