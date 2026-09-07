import 'server-only';
import sanitizeHtml from 'sanitize-html';

/**
 * ניקוי HTML של תוכן שנוצר בעורך (עמודים סטטיים / בלוג) לפני שמירה ולפני רינדור.
 * מתיר רק תגיות עיצוב בסיסיות + קישורים ותמונות.
 */
export function sanitizeRichHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? '', {
    allowedTags: [
      'p', 'br', 'hr',
      'h2', 'h3', 'h4',
      'strong', 'b', 'em', 'i', 'u', 's',
      'ul', 'ol', 'li',
      'blockquote',
      'a', 'img',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.href && /^https?:/i.test(attribs.href)
            ? { target: '_blank', rel: 'noopener noreferrer nofollow' }
            : {}),
        },
      }),
    },
  });
}

/** תקציר טקסט נקי מתוך HTML (ל-meta description / כרטיסי בלוג). */
export function htmlToText(html: string, max = 200): string {
  const text = sanitizeHtml(html ?? '', { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
