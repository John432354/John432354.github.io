/**
 * GitHub File-Size-Safe Subject Chunk Exporter (`< 18 KB` per file)
 */

const MAX_CHUNK_BYTES = 18 * 1024;

export function slugifySubjectName(name) {
  return (
    String(name || 'subject')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'subject'
  );
}

export function serializeSubjectToJsModule(subject) {
  const slug = slugifySubjectName(subject.name);
  const exportConst = `SUBJECT_${slug.toUpperCase().replace(/-/g, '_')}`;
  const cleanCards = (subject.cards || []).map((c) => ({
    id: c.id,
    terms: Array.isArray(c.terms) ? c.terms : [c.term],
    term: c.term,
    definition: c.definition,
    explanation: c.explanation || '',
    unit: c.unit || '',
    topic: c.topic || 'General',
  }));

  const code = [
    `// Auto-generated Suite Subject Module (${cleanCards.length} terms)`,
    `export const ${exportConst} = ${JSON.stringify(
      {
        id: subject.id,
        name: subject.name,
        description: subject.description,
        icon: subject.icon,
        accent: subject.accent,
        cards: cleanCards,
      },
      null,
      2
    )};`,
    '',
  ].join('\n');

  return {
    filename: `${slug}.subject.js`,
    exportConst,
    code,
  };
}

export function splitSubjectIntoSmallModuleFiles(subject) {
  const slug = slugifySubjectName(subject.name);
  const cards = subject.cards || [];
  const cardBatches = [];
  let currentBatch = [];
  let currentBytes = 0;

  for (const card of cards) {
    const clean = {
      id: card.id,
      terms: Array.isArray(card.terms) ? card.terms : [card.term],
      term: card.term,
      definition: card.definition,
      explanation: card.explanation || '',
      unit: card.unit || '',
      topic: card.topic || 'General',
    };
    const serialized = JSON.stringify(clean);
    if (currentBatch.length > 0 && currentBytes + serialized.length > MAX_CHUNK_BYTES) {
      cardBatches.push(currentBatch);
      currentBatch = [];
      currentBytes = 0;
    }
    currentBatch.push(clean);
    currentBytes += serialized.length;
  }
  if (currentBatch.length > 0 || cardBatches.length === 0) {
    cardBatches.push(currentBatch);
  }

  if (cardBatches.length === 1) {
    const single = serializeSubjectToJsModule(subject);
    return [{ filename: single.filename, content: single.code }];
  }

  const files = [];
  const partImports = [];
  const partSpreads = [];

  cardBatches.forEach((batch, idx) => {
    const partNum = idx + 1;
    const constName = `CARDS_PART_${partNum}`;
    const partFile = `${slug}.part${partNum}.js`;
    partImports.push(`import { ${constName} } from './${partFile}';`);
    partSpreads.push(`    ...${constName},`);
    files.push({
      filename: partFile,
      content: `export const ${constName} = ${JSON.stringify(batch, null, 2)};\n`,
    });
  });

  const exportConst = `SUBJECT_${slug.toUpperCase().replace(/-/g, '_')}`;
  const indexContent = [
    ...partImports,
    '',
    `export const ${exportConst} = {`,
    `  id: ${JSON.stringify(subject.id)},`,
    `  name: ${JSON.stringify(subject.name)},`,
    `  description: ${JSON.stringify(subject.description)},`,
    `  icon: ${JSON.stringify(subject.icon)},`,
    `  accent: ${JSON.stringify(subject.accent)},`,
    `  cards: [`,
    ...partSpreads,
    `  ],`,
    `};`,
    '',
  ].join('\n');

  files.unshift({ filename: `${slug}.index.js`, content: indexContent });
  return files;
}
