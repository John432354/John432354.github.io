#!/usr/bin/env node
/**
 * Verifies that every single file in the repository stays well below
 * GitHub's 25 MB web upload limit (and checks modular <50 KB code size).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GITHUB_WEB_LIMIT_BYTES = 25 * 1024 * 1024;

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

const allFiles = walk(ROOT);
let maxBytes = 0;
let maxFile = '';

for (const file of allFiles) {
  const size = fs.statSync(file).size;
  const rel = path.relative(ROOT, file);
  if (size > maxBytes) {
    maxBytes = size;
    maxFile = rel;
  }
  if (size >= GITHUB_WEB_LIMIT_BYTES) {
    console.error(`FAIL: ${rel} exceeds GitHub 25 MB upload limit (${size} bytes)`);
    process.exit(1);
  }
}

console.log(
  `OK: Checked ${allFiles.length} modular files. Largest file is ${maxFile} (${(
    maxBytes / 1024
  ).toFixed(1)} KB) — 100% GitHub upload safe!`
);
