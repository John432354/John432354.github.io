/**
 * Safe DOM Formatting & Escaping Utilities
 */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

export function formatMeters(meters) {
  return `${Math.round(Number(meters) || 0).toLocaleString()} m`;
}

export function formatSeconds(ms) {
  const sec = Math.max(0, Number(ms) || 0) / 1000;
  return `${sec.toFixed(1)}s`;
}

export function formatPercent(prob) {
  const pct = Math.max(0, Math.min(100, (Number(prob) || 0) * 100));
  return `${pct.toFixed(1)}%`;
}

export function formatBytesMb(bytes) {
  if (!bytes || bytes <= 0) return '0 MB';
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
