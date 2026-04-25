/**
 * Decode the HTML entities that the LLM occasionally emits in plain-text fields.
 * This is intentionally limited to the most common entities — full HTML decoding
 * is the browser's job (don't use this on innerHTML).
 *
 * @param {string} text
 * @returns {string}
 */
export function decodeHtmlEntities(text) {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
