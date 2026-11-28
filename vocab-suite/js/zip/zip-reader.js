/**
 * Pure-Browser ZIP Archive Reader (Zero External Dependencies)
 *
 * Parses Central Directory headers and extracts UTF-8 text entries using
 * `STORE` (method 0) or native `DecompressionStream('deflate-raw')` (method 8).
 * Automatically skips macOS `__MACOSX/`, `.DS_Store`, and `._*` metadata files.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CEN_SIGNATURE = 0x02014b50;
const LOC_SIGNATURE = 0x04034b50;

export function isIgnoredZipPath(entryPath) {
  const normalized = String(entryPath || '').replace(/\\/g, '/');
  if (!normalized || normalized.endsWith('/')) return true;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.includes('__MACOSX')) return true;
  const base = segments[segments.length - 1] || '';
  if (base === '.DS_Store' || base.startsWith('._') || base === 'Thumbs.db') return true;
  return false;
}

function findEndOfCentralDirectory(view) {
  const maxComment = 65535;
  const minOffset = Math.max(0, view.byteLength - 22 - maxComment);
  for (let pos = view.byteLength - 22; pos >= minOffset; pos -= 1) {
    if (view.getUint32(pos, true) === EOCD_SIGNATURE) {
      return pos;
    }
  }
  throw new Error('Invalid ZIP file (End-of-Central-Directory signature not found).');
}

async function inflateRawBytes(compressedBytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Your browser does not support DecompressionStream for compressed ZIPs.');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressedBytes);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks = [];
  let totalLen = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.byteLength;
  }

  const output = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function extractTextFilesFromZipBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder('utf-8');

  const eocdOffset = findEndOfCentralDirectory(view);
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  let ptr = cdOffset;
  const extracted = [];

  for (let i = 0; i < totalEntries; i += 1) {
    if (ptr + 46 > view.byteLength || view.getUint32(ptr, true) !== CEN_SIGNATURE) {
      break;
    }

    const compressionMethod = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const fileNameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + fileNameLen);
    const entryPath = decoder.decode(nameBytes).replace(/\\/g, '/');

    ptr += 46 + fileNameLen + extraLen + commentLen;

    if (isIgnoredZipPath(entryPath)) continue;
    if (!entryPath.toLowerCase().endsWith('.txt')) continue;

    if (view.getUint32(localHeaderOffset, true) !== LOC_SIGNATURE) {
      throw new Error(`Corrupt local file header for "${entryPath}".`);
    }

    const locNameLen = view.getUint16(localHeaderOffset + 26, true);
    const locExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + locNameLen + locExtraLen;
    const rawSlice = bytes.subarray(dataStart, dataStart + compressedSize);

    let rawContentBytes;
    if (compressionMethod === 0) {
      rawContentBytes = rawSlice;
    } else if (compressionMethod === 8) {
      rawContentBytes = await inflateRawBytes(rawSlice);
    } else {
      throw new Error(
        `Unsupported ZIP compression method (${compressionMethod}) in "${entryPath}". Use standard Deflate or Store.`
      );
    }

    extracted.push({
      path: entryPath,
      text: decoder.decode(rawContentBytes),
    });
  }

  return extracted;
}
