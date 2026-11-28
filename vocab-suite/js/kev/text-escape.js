/**
 * Kev Caller-Text Sanitizer
 *
 * Kev uses Qwen special tokens (`<|fim_prefix|>`, `<|box_end|>`, etc.) as
 * structural branch & pointer delimiters. Replacing `<|name|>` with `<¦name¦>`
 * matches `kev.model.user_tokens` so user answers can never forge delimiters.
 */

const DELIMITER_PATTERN = /<\|([A-Za-z0-9_]+)\|>/g;

export function escapeKevUserText(text) {
  return String(text ?? '').replace(DELIMITER_PATTERN, '<\u00A6$1\u00A6>');
}

export function normalizeWhitespace(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}
