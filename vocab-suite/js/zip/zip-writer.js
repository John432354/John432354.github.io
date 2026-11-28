/**
 * Pure-Browser ZIP Archive Builder (STORE mode, UTF-8)
 *
 * Generates valid `.zip` files right in the browser for:
 * 1. Downloading a sample `AP Lang.zip` template on the Creator Spec page.
 * 2. Exporting any created Subject back into `<Subject Name>.zip` with Unit folders & `.txt` Topic files.
 */

import { crc32 } from './crc32.js';

export function buildZipBlobFromTextEntries(entries = []) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const item of entries) {
    const cleanPath = String(item.path || '').replace(/^\/+/, '');
    const nameBytes = encoder.encode(cleanPath);
    const dataBytes = encoder.encode(String(item.text ?? ''));
    const checksum = crc32(dataBytes);

    // Local file header (30 bytes + filename)
    const loc = new Uint8Array(30 + nameBytes.length);
    const locView = new DataView(loc.buffer);
    locView.setUint32(0, 0x04034b50, true);
    locView.setUint16(4, 20, true); // version needed
    locView.setUint16(6, 0x0800, true); // UTF-8 flag
    locView.setUint16(8, 0, true); // STORE (0)
    locView.setUint16(10, 0, true);
    locView.setUint16(12, 0, true);
    locView.setUint32(14, checksum, true);
    locView.setUint32(18, dataBytes.length, true);
    locView.setUint32(22, dataBytes.length, true);
    locView.setUint16(26, nameBytes.length, true);
    locView.setUint16(28, 0, true);
    loc.set(nameBytes, 30);

    localParts.push(loc, dataBytes);

    // Central directory header (46 bytes + filename)
    const cen = new Uint8Array(46 + nameBytes.length);
    const cenView = new DataView(cen.buffer);
    cenView.setUint32(0, 0x02014b50, true);
    cenView.setUint16(4, 20, true);
    cenView.setUint16(6, 20, true);
    cenView.setUint16(8, 0x0800, true); // UTF-8 flag
    cenView.setUint16(10, 0, true); // STORE
    cenView.setUint16(12, 0, true);
    cenView.setUint16(14, 0, true);
    cenView.setUint32(16, checksum, true);
    cenView.setUint32(20, dataBytes.length, true);
    cenView.setUint32(24, dataBytes.length, true);
    cenView.setUint16(28, nameBytes.length, true);
    cenView.setUint16(30, 0, true);
    cenView.setUint16(32, 0, true);
    cenView.setUint16(34, 0, true);
    cenView.setUint16(36, 0, true);
    cenView.setUint32(38, 0, true);
    cenView.setUint32(42, offset, true);
    cen.set(nameBytes, 46);

    centralParts.push(cen);
    offset += loc.length + dataBytes.length;
  }

  const cdOffset = offset;
  const cdSize = centralParts.reduce((sum, p) => sum + p.length, 0);

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, entries.length, true);
  eocdView.setUint16(10, entries.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, cdOffset, true);
  eocdView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, eocd], {
    type: 'application/zip',
  });
}
