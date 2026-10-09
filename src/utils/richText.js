import DOMPurify from "dompurify";

/**
 * Sanitize stored rich-text HTML before rendering it. Prevents stored XSS from
 * pasted/linked content while still allowing images (including data URLs).
 */
export function sanitizeRichText(html) {
  if (!html) {
    return "";
  }

  return DOMPurify.sanitize(html, {
    ADD_DATA_URI_TAGS: ["img"],
    ADD_ATTR: ["target", "rel"],
  });
}

/**
 * Normalise stored request details for display. New records are rich-text HTML;
 * older records may be plain text with line breaks, so handle both safely.
 */
export function formatRichTextForDisplay(value) {
  if (!value) {
    return "";
  }

  const trimmed = String(value).trim();

  if (!/<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    const escaped = trimmed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return escaped.replace(/\r?\n/g, "<br />");
  }

  return sanitizeRichText(trimmed);
}

/**
 * Convert rich-text HTML to plain text so it can be used for validation and
 * simple summaries. Returns an empty string when there is no visible text.
 */
export function htmlToPlainText(html) {
  if (!html) {
    return "";
  }

  const doc = new DOMParser().parseFromString(html, "text/html");

  return (doc.body.textContent || "").replace(/\u00a0/g, " ").trim();
}

