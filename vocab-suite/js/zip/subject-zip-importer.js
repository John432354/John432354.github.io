/**
 * Subject ZIP Importer & Exporter (`<Subject Name>.zip` -> Optional Unit Folders -> `<Topic>.txt`)
 *
 * Example ZIP structures supported seamlessly:
 *   1. Flat Topics inside `AP Lang.zip`:
 *        Tones Vocab.txt         -> Subject: "AP Lang", Unit: "", Topic: "Tones Vocab"
 *        Rhetorical Devices.txt  -> Subject: "AP Lang", Unit: "", Topic: "Rhetorical Devices"
 *
 *   2. Unit Breakdown via Folders inside `AP Lang.zip`:
 *        Unit 1 - Rhetoric/Tones Vocab.txt      -> Subject: "AP Lang", Unit: "Unit 1 - Rhetoric", Topic: "Tones Vocab"
 *        Unit 2 - Argument/Logical Fallacies.txt -> Subject: "AP Lang", Unit: "Unit 2 - Argument", Topic: "Logical Fallacies"
 *
 *   3. Wrapped Root Folder (when user zips a folder named `AP Lang/`):
 *        AP Lang/Unit 1 - Rhetoric/Tones Vocab.txt -> Automatically unwraps outer `AP Lang/`!
 */

import { extractTextFilesFromZipBuffer } from './zip-reader.js';
import { buildZipBlobFromTextEntries } from './zip-writer.js';
import { parseTopicTxtContent, serializeCardsToTxt } from '../../subjects/txt-parser.js';
import { normalizeSubject, buildSubjectHierarchy } from '../../subjects/schema.js';

function stripExtension(filename, extPattern) {
  return String(filename || '').replace(extPattern, '').trim();
}

export async function parseSubjectFromZipFile(fileOrBuffer, zipFileName) {
  const effectiveZipName = zipFileName || fileOrBuffer?.name || 'Subject.zip';
  const subjectNameFromZip = stripExtension(effectiveZipName, /\.zip$/i) || 'Imported Subject';
  const buffer =
    fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();

  const txtEntries = await extractTextFilesFromZipBuffer(buffer);
  if (txtEntries.length === 0) {
    throw new Error('No .txt topic files were found inside the uploaded .zip archive.');
  }

  // Detect if every file shares a single top-level wrapper directory matching the subject name
  // (e.g. macOS/Windows "Compress 'AP Lang'" creates `AP Lang/Unit 1/Tones Vocab.txt`)
  const splitPaths = txtEntries.map((e) => e.path.split('/').filter(Boolean));
  const firstSegments = new Set(
    splitPaths.filter((segs) => segs.length >= 2).map((segs) => segs[0])
  );
  const allHaveSubfolders = splitPaths.every((segs) => segs.length >= 2);
  const singleRootDir = allHaveSubfolders && firstSegments.size === 1 ? [...firstSegments][0] : null;
  const shouldUnwrapRoot =
    singleRootDir &&
    singleRootDir.toLowerCase() === subjectNameFromZip.toLowerCase();

  const allCards = [];
  const unitsSet = new Set();
  const topicsSet = new Set();

  for (let i = 0; i < txtEntries.length; i += 1) {
    const rawSegs = splitPaths[i];
    const segs = shouldUnwrapRoot ? rawSegs.slice(1) : rawSegs;

    const fileBase = segs[segs.length - 1];
    const topicName = stripExtension(fileBase, /\.txt$/i) || 'Vocabulary';
    const unitFolders = segs.slice(0, -1);
    const unitName = unitFolders.join(' / ').trim();

    const parsedCards = parseTopicTxtContent(txtEntries[i].text, {
      unit: unitName,
      topic: topicName,
    });

    if (parsedCards.length > 0) {
      if (unitName) unitsSet.add(unitName);
      topicsSet.add(topicName);
      allCards.push(...parsedCards);
    }
  }

  if (allCards.length === 0) {
    throw new Error(
      'Found .txt files in ZIP, but no valid "Term : Definition" lines could be parsed. Check the Creator Spec for syntax examples.'
    );
  }

  const unitCount = unitsSet.size;
  const topicCount = topicsSet.size;
  const descParts = [];
  if (unitCount > 0) descParts.push(`${unitCount} unit${unitCount === 1 ? '' : 's'}`);
  descParts.push(`${topicCount} topic${topicCount === 1 ? '' : 's'}`);

  const normalized = normalizeSubject({
    name: subjectNameFromZip,
    description: `Imported from ${effectiveZipName} (${descParts.join(' · ')})`,
    icon: '📦',
    accent: '#38f2ff',
    cards: allCards,
  });
  normalized.zipStats = { unitCount, topicCount };
  return normalized;
}

export function exportSubjectToZipBlob(subject) {
  const hierarchy = buildSubjectHierarchy(subject);
  const zipEntries = [];

  for (const [unitName, topicMap] of hierarchy.entries()) {
    for (const [topicName, cards] of topicMap.entries()) {
      const safeTopic = topicName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Topic';
      const safeUnit = unitName
        ? unitName
            .split('/')
            .map((s) => s.replace(/[\\:*?"<>|]/g, '-').trim())
            .filter(Boolean)
            .join('/')
        : '';

      const relPath = safeUnit ? `${safeUnit}/${safeTopic}.txt` : `${safeTopic}.txt`;
      const header = safeUnit
        ? `${subject.name} — ${safeUnit} — ${topicName}`
        : `${subject.name} — ${topicName}`;
      zipEntries.push({
        path: relPath,
        text: serializeCardsToTxt(cards, header),
      });
    }
  }

  const safeSubjectName = String(subject.name || 'Subject').replace(/[/\\:*?"<>|]/g, '_');
  return {
    filename: `${safeSubjectName}.zip`,
    blob: buildZipBlobFromTextEntries(zipEntries),
  };
}

export function buildSampleApLangZipBlob() {
  const entries = [
    {
      path: 'Unit 1 - Rhetorical Foundations/Tones Vocab.txt',
      text: [
        '// AP Lang — Unit 1: Tones Vocab',
        '// Demonstrates multiple valid answers (-) and Java comment explanations (// and /* */)',
        '',
        'Acerbic - Caustic - Biting : Sharp, forthright, and harsh in expression // Think of acid cutting through polite phrasing; common in sharp satire.',
        'Sanguine - Optimistic - Hopeful : Cheerfully confident about the future, especially in difficult circumstances',
        '// Often contrasted with cynical, fatalistic, or melancholic tones.',
        'Didactic - Moralizing - Instructive : Intended to teach or convey moral instruction, sometimes overly lecturing',
        '/* Frequently appears on AP Lang exams when an essayist lectures the audience on virtue. */',
        'Elegiac - Mournful : Expressing sorrow or lamentation for something now past // Common in reflective tributes and eulogies.',
        'Ambivalent : Having mixed, contradictory feelings about a person or issue // Not the same as indifferent! Ambivalent means pulled strongly in two directions.',
        '',
      ].join('\n'),
    },
    {
      path: 'Unit 1 - Rhetorical Foundations/Appeals & Syntax.txt',
      text: [
        '// AP Lang — Unit 1: Rhetorical Appeals & Syntax',
        '',
        'Anaphora : Repetition of a word or phrase at the beginning of successive clauses // Example: "We shall fight on the beaches, we shall fight on the landing grounds..."',
        'Juxtaposition - Contrast : Placing two contrasting elements side by side to highlight their differences',
        'Chiasmus : Reversal of grammatical structures in successive phrases (ABBA pattern) // Example: "Ask not what your country can do for you—ask what you can do for your country."',
        'Kairos : Appeal to timeliness and the urgency of the opportune moment // Explains why an argument matters RIGHT NOW.',
        '',
      ].join('\n'),
    },
    {
      path: 'Unit 2 - Argument & Fallacies/Logical Fallacies.txt',
      text: [
        '// AP Lang — Unit 2: Logical Fallacies',
        '',
        'Ad Hominem : Attacking the character or motive of the speaker rather than addressing the substance of the argument // Latin for "to the person".',
        'Straw Man - Strawman : Misrepresenting or exaggerating an opponent\'s position to make it easier to attack',
        'Equivocation : Using an ambiguous word in more than one sense within an argument to mislead',
        '',
      ].join('\n'),
    },
  ];

  return {
    filename: 'AP Lang.zip',
    blob: buildZipBlobFromTextEntries(entries),
  };
}
