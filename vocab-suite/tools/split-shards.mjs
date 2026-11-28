#!/usr/bin/env node
/**
 * Optional CLI Utility: Splits any large ONNX / binary file into < 20 MB shards
 * and emits a `manifest.shards.json` for `js/kev/shard-reassembler.js`.
 *
 * Usage:
 *   node tools/split-shards.mjs ./model_q4f16.onnx_data ./shards-out 18
 */

import fs from 'node:fs';
import path from 'node:path';

const [, , inputPath, outDir = './shards-out', maxMbArg = '18'] = process.argv;

if (!inputPath) {
  console.log('Usage: node tools/split-shards.mjs <large-file> [out-dir] [max-mb-per-shard]');
  process.exit(1);
}

const maxBytes = Math.floor(Number(maxMbArg) * 1024 * 1024);
const resolvedIn = path.resolve(inputPath);
const resolvedOut = path.resolve(outDir);
fs.mkdirSync(resolvedOut, { recursive: true });

const stat = fs.statSync(resolvedIn);
const baseName = path.basename(resolvedIn);
const fd = fs.openSync(resolvedIn, 'r');

const parts = [];
let offset = 0;
let idx = 0;

while (offset < stat.size) {
  const chunkLen = Math.min(maxBytes, stat.size - offset);
  const buf = Buffer.allocUnsafe(chunkLen);
  fs.readSync(fd, buf, 0, chunkLen, offset);
  const partName = `${baseName}.part-${String(idx).padStart(3, '0')}.bin`;
  fs.writeFileSync(path.join(resolvedOut, partName), buf);
  parts.push(`./${partName}`);
  offset += chunkLen;
  idx += 1;
}

fs.closeSync(fd);

const manifest = {
  generatedAt: new Date().toISOString(),
  maxShardBytes: maxBytes,
  files: {
    [baseName]: {
      totalBytes: stat.size,
      parts,
    },
  },
};

const manifestPath = path.join(resolvedOut, 'manifest.shards.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Split ${baseName} (${stat.size} bytes) into ${parts.length} shards in ${resolvedOut}`);
