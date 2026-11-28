/**
 * Stored Subjects, Units & Topics Repository
 *
 * Supports:
 * - Empty built-in registry (`BUILT_IN_SUBJECTS = []`)
 * - Uploading `<Subject>.zip` files with optional Unit folders & `<Topic>.txt` files
 * - Granular Unit & Topic selection inside each Subject
 * - Shared card pool for both Krillion and Vocab Wordle
 */

import { BUILT_IN_SUBJECTS } from '../../subjects/index.js';
import { normalizeSubject, normalizeCard, buildSubjectHierarchy } from '../../subjects/schema.js';
import { STORAGE_KEYS } from './storage-keys.js';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

export function makeTopicFilterKey(subjectId, unitName, topicName) {
  return `${subjectId}::${unitName || ''}::${topicName || 'General'}`;
}

export class SubjectRepository {
  constructor() {
    this.builtIn = BUILT_IN_SUBJECTS.map((s) =>
      normalizeSubject({ ...s, builtIn: true })
    );
    const saved = readJson(STORAGE_KEYS.USER_SUBJECTS, []);
    this.userSubjects = Array.isArray(saved)
      ? saved
          .map((s) => {
            try {
              return normalizeSubject({ ...s, builtIn: false });
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      : [];

    const savedSelected = readJson(STORAGE_KEYS.SELECTED_SUBJECT_IDS, []);
    this.selectedIds = new Set(Array.isArray(savedSelected) ? savedSelected : []);

    // Excluded topic keys allow opting out of individual units/topics within a selected subject
    const savedExcluded = readJson(STORAGE_KEYS.EXCLUDED_TOPIC_KEYS, []);
    this.excludedTopicKeys = new Set(Array.isArray(savedExcluded) ? savedExcluded : []);

    this.pruneSelectedIds();
  }

  pruneSelectedIds() {
    const validIds = new Set(this.getAllSubjects().map((s) => s.id));
    for (const id of [...this.selectedIds]) {
      if (!validIds.has(id)) this.selectedIds.delete(id);
    }
    if (this.selectedIds.size === 0 && validIds.size > 0) {
      const first = this.getAllSubjects()[0];
      if (first) this.selectedIds.add(first.id);
    }
    this.persistSelection();
  }

  getAllSubjects() {
    return [...this.builtIn, ...this.userSubjects];
  }

  getSubjectById(id) {
    return this.getAllSubjects().find((s) => s.id === id) || null;
  }

  getSelectedIds() {
    return [...this.selectedIds];
  }

  getSelectedSubjects() {
    return this.getAllSubjects().filter((s) => this.selectedIds.has(s.id));
  }

  isTopicEnabled(subjectId, unitName, topicName) {
    if (!this.selectedIds.has(subjectId)) return false;
    return !this.excludedTopicKeys.has(makeTopicFilterKey(subjectId, unitName, topicName));
  }

  toggleTopic(subjectId, unitName, topicName) {
    if (!this.selectedIds.has(subjectId)) {
      this.selectedIds.add(subjectId);
    }
    const key = makeTopicFilterKey(subjectId, unitName, topicName);
    if (this.excludedTopicKeys.has(key)) {
      this.excludedTopicKeys.delete(key);
    } else {
      this.excludedTopicKeys.add(key);
    }
    this.persistSelection();
  }

  toggleUnit(subjectId, unitName) {
    const subj = this.getSubjectById(subjectId);
    if (!subj) return;
    if (!this.selectedIds.has(subjectId)) {
      this.selectedIds.add(subjectId);
    }
    const hierarchy = buildSubjectHierarchy(subj);
    const topicMap = hierarchy.get(unitName || '');
    if (!topicMap) return;

    const topicNames = [...topicMap.keys()];
    const allEnabled = topicNames.every((t) => this.isTopicEnabled(subjectId, unitName, t));

    for (const t of topicNames) {
      const key = makeTopicFilterKey(subjectId, unitName, t);
      if (allEnabled) {
        this.excludedTopicKeys.add(key);
      } else {
        this.excludedTopicKeys.delete(key);
      }
    }
    this.persistSelection();
  }

  /**
   * Returns selected subjects with their `.cards` filtered to enabled Units & Topics.
   */
  getFilteredSelectedSubjects() {
    const result = [];
    for (const subj of this.getSelectedSubjects()) {
      const activeCards = (subj.cards || []).filter(
        (c) =>
          !this.excludedTopicKeys.has(
            makeTopicFilterKey(subj.id, c.unit || '', c.topic || 'General')
          )
      );
      if (activeCards.length > 0) {
        result.push({ ...subj, cards: activeCards });
      }
    }
    return result;
  }

  toggleSubjectSelection(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
      // Re-enable all topics inside this subject when freshly toggled on if all were excluded
      const subj = this.getSubjectById(id);
      if (subj) {
        const anyEnabled = (subj.cards || []).some(
          (c) =>
            !this.excludedTopicKeys.has(
              makeTopicFilterKey(id, c.unit || '', c.topic || 'General')
            )
        );
        if (!anyEnabled) {
          for (const c of subj.cards || []) {
            this.excludedTopicKeys.delete(
              makeTopicFilterKey(id, c.unit || '', c.topic || 'General')
            );
          }
        }
      }
    }
    this.persistSelection();
  }

  selectAllSubjects() {
    this.getAllSubjects().forEach((s) => this.selectedIds.add(s.id));
    this.excludedTopicKeys.clear();
    this.persistSelection();
  }

  clearSelection() {
    this.selectedIds.clear();
    this.persistSelection();
  }

  saveSubject(subjectInput, { mergeByName = false } = {}) {
    const normalized = normalizeSubject({ ...subjectInput, builtIn: false });

    if (mergeByName) {
      const byNameIdx = this.userSubjects.findIndex(
        (s) => s.name.toLowerCase() === normalized.name.toLowerCase()
      );
      if (byNameIdx >= 0) {
        normalized.id = this.userSubjects[byNameIdx].id;
        this.userSubjects[byNameIdx] = normalized;
        this.selectedIds.add(normalized.id);
        this.persist();
        return normalized;
      }
    }

    const existingIdx = this.userSubjects.findIndex((s) => s.id === normalized.id);
    if (existingIdx >= 0) {
      this.userSubjects[existingIdx] = normalized;
    } else {
      this.userSubjects.push(normalized);
      this.selectedIds.add(normalized.id);
    }
    this.persist();
    return normalized;
  }

  deleteSubject(id) {
    this.userSubjects = this.userSubjects.filter((s) => s.id !== id);
    this.selectedIds.delete(id);
    this.persist();
  }

  saveCustomSubject(subjectInput) {
    return this.saveSubject(subjectInput, { mergeByName: !subjectInput?.id });
  }

  deleteCustomSubject(id) {
    return this.deleteSubject(id);
  }

  addCardsToSubject(subjectId, rawCards) {
    const subj = this.userSubjects.find((s) => s.id === subjectId);
    if (!subj) throw new Error('Cannot modify a read-only or missing subject.');
    const normalizedNew = rawCards
      .map((c, idx) => normalizeCard(c, subj.cards.length + idx))
      .filter(Boolean);
    subj.cards.push(...normalizedNew);
    subj.updatedAt = Date.now();
    this.persist();
    return subj;
  }

  importSubjectsFromJson(data) {
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.subjects)
      ? data.subjects
      : data && typeof data === 'object' && data.name
      ? [data]
      : [];

    const imported = [];
    for (const item of list) {
      const saved = this.saveSubject(item);
      imported.push(saved);
    }
    return imported;
  }

  persistSelection() {
    writeJson(STORAGE_KEYS.SELECTED_SUBJECT_IDS, [...this.selectedIds]);
    writeJson(STORAGE_KEYS.EXCLUDED_TOPIC_KEYS, [...this.excludedTopicKeys]);
  }

  persist() {
    writeJson(STORAGE_KEYS.USER_SUBJECTS, this.userSubjects);
    this.persistSelection();
  }
}
