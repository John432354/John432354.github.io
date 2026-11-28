/**
 * Google Drive & Browser Download Helper Utilities
 */

export function extractGoogleDriveFileId(input) {
  const str = String(input ?? '').trim();
  if (!str) return null;
  if (/^[A-Za-z0-9_-]{20,}$/.test(str)) return str;
  const fileMatch = str.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idParamMatch = str.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  return null;
}

export function buildGoogleDriveCorsUrl(fileIdOrUrl, apiKey = '') {
  const trimmedKey = String(apiKey ?? '').trim();
  const fileId = extractGoogleDriveFileId(fileIdOrUrl);
  if (fileId && trimmedKey) {
    return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId
    )}?alt=media&key=${encodeURIComponent(trimmedKey)}`;
  }
  return String(fileIdOrUrl ?? '').trim();
}

export async function fetchJsonFromDriveOrUrl(fileIdOrUrl, apiKey = '') {
  const url = buildGoogleDriveCorsUrl(fileIdOrUrl, apiKey);
  if (!url) {
    throw new Error('Please provide a valid URL or Google Drive File ID.');
  }
  if (url.includes('drive.google.com') && !apiKey) {
    throw new Error(
      'Direct drive.google.com links block browser CORS on github.io. Supply a public Google API Key or download the .zip from Drive and drop it into the uploader.'
    );
  }
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) {
    throw new Error(`Remote fetch failed (HTTP ${res.status}). Check sharing permissions.`);
  }
  return res.json();
}

export function downloadBlobFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1800);
}

export function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  downloadBlobFile(filename, blob);
}
