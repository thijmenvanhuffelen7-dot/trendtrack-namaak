import sanitizeHtml from "sanitize-html";

/** Bekende tracking-domeinen voor open-pixels. */
const TRACKER_HOSTS = [
  /(^|\.)klaviyo\.com$/,
  /(^|\.)klclick\d*\.com$/,
  /(^|\.)list-manage\.com$/,
  /(^|\.)mailchimp\.com$/,
  /(^|\.)omnisend\.com$/,
  /(^|\.)sendgrid\.net$/,
  /(^|\.)mailgun\.org$/,
  /(^|\.)mandrillapp\.com$/,
  /(^|\.)hubspotemail\.net$/,
  /(^|\.)google-analytics\.com$/,
  /(^|\.)doubleclick\.net$/,
];

const UNSUBSCRIBE =
  /unsubscribe|afmelden|uitschrijven|abmelden|d[ée]sinscri|preferences|voorkeuren|manage.?subscription|opt.?out/i;

export interface SanitizeOptions {
  /** Ons eigen seed-adres: halen we overal uit de HTML. */
  seedAddress?: string;
}

/**
 * Maakt mail-HTML veilig om te tonen in een sandboxed iframe en haalt persoonlijke dingen weg:
 * - geen scripts, iframes, forms, objects, meta-tags, event-handlers, javascript:-links
 * - tracking-pixels (1×1 of van bekende trackers) eruit
 * - afmeld-/voorkeurslinks onklikbaar (die zijn persoonlijk en zouden ons seed-adres afmelden)
 * - ons seed-adres vervangen door een placeholder
 * Inline styles blijven: zonder styles is een nieuwsbrief onleesbaar.
 */
export function sanitizeEmailHtml(html: string, opts: SanitizeOptions = {}): string {
  let clean = sanitizeHtml(html, {
    allowedTags: [
      "html",
      "head",
      "body",
      "style",
      "title",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "colgroup",
      "col",
      "caption",
      "div",
      "span",
      "p",
      "br",
      "hr",
      "center",
      "font",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "small",
      "sup",
      "sub",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "a",
      "img",
      "picture",
      "source",
    ],
    allowedAttributes: {
      "*": [
        "style",
        "class",
        "align",
        "valign",
        "width",
        "height",
        "bgcolor",
        "border",
        "dir",
        "lang",
        "title",
        "role",
      ],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "srcset"],
      source: ["srcset", "media", "type"],
      table: ["cellpadding", "cellspacing"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      font: ["color", "face", "size"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    allowVulnerableTags: true, // <style> toestaan; scripts blijven verboden
    allowProtocolRelative: false,
    nonTextTags: [
      "script",
      "noscript",
      "textarea",
      "option",
      "iframe",
      "object",
      "embed",
      "form",
      "meta",
    ],
    exclusiveFilter: (frame) => {
      if (frame.tag === "img") return isTrackingPixel(frame.attribs);
      return false;
    },
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        if (UNSUBSCRIBE.test(href) || /^mailto:/i.test(href)) {
          const { href: _h, ...rest } = attribs;
          return { tagName, attribs: { ...rest, "data-removed": "personal-link" } };
        }
        return {
          tagName,
          attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
        };
      },
    },
  });
  // Ook afmeldlinks waarvan alleen de linktekst "afmelden" zegt.
  clean = clean.replace(
    /<a\b([^>]*)\shref="[^"]*"([^>]*)>(\s*(?:[^<]*?)(?:unsubscribe|afmelden|uitschrijven)[^<]*)<\/a>/gi,
    '<a$1$2 data-removed="personal-link">$3</a>',
  );
  if (opts.seedAddress) {
    clean = clean.split(opts.seedAddress).join("jij@voorbeeld.nl");
    clean = clean.split(encodeURIComponent(opts.seedAddress)).join("jij%40voorbeeld.nl");
  }
  return clean;
}

function isTrackingPixel(attribs: Record<string, string>): boolean {
  const w = Number.parseInt(attribs.width ?? "", 10);
  const h = Number.parseInt(attribs.height ?? "", 10);
  if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) return true;
  if (/(width|height)\s*:\s*[01]px/i.test(attribs.style ?? "")) return true;
  try {
    const host = new URL(attribs.src ?? "").hostname;
    if (
      TRACKER_HOSTS.some((re) => re.test(host)) &&
      /open|track|pixel|beacon|\.gif/i.test(attribs.src ?? "")
    )
      return true;
  } catch {
    // geen geldige URL
  }
  return false;
}

/**
 * Preheader = de (vaak verborgen) eerste tekstregel die mailclients naast het onderwerp tonen.
 * Eerst een verborgen element zoeken, anders de eerste tekst van de body.
 */
export function extractPreheader(html: string, maxLength = 150): string | null {
  const hidden = html.match(
    /<(div|span|p)[^>]*style=["'][^"']*(display\s*:\s*none|max-height\s*:\s*0|opacity\s*:\s*0)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i,
  );
  const text =
    toPlainText(hidden?.[3] ?? "") ||
    toPlainText(html.replace(/<(style|title|head)[\s\S]*?<\/\1>/gi, ""));
  return text ? text.slice(0, maxLength).trim() : null;
}

export function toPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;|&#160;|&zwnj;|&#8204;|\u200c|\u00a0/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
