/**
 * Detectielijst voor Shopify-apps en marketing-tools op basis van scripts/HTML in de storefront.
 * Een app telt als gevonden als één van de patronen in de HTML voorkomt.
 * Uitbreiden: voeg een entry toe en een fixture-test als het patroon niet triviaal is.
 */
export type AppCategory =
  | "email"
  | "sms"
  | "reviews"
  | "subscriptions"
  | "upsell"
  | "page-builder"
  | "loyalty"
  | "support"
  | "search"
  | "translation"
  | "payments"
  | "analytics"
  | "pixel"
  | "popup"
  | "consent"
  | "shipping"
  | "conversion"
  | "trust";

export interface AppSignature {
  id: string;
  name: string;
  category: AppCategory;
  patterns: RegExp[];
}

export const APP_SIGNATURES: readonly AppSignature[] = [
  // E-mail & SMS
  {
    id: "klaviyo",
    name: "Klaviyo",
    category: "email",
    patterns: [/static\.klaviyo\.com/i, /klaviyo\.js/i],
  },
  {
    id: "omnisend",
    name: "Omnisend",
    category: "email",
    patterns: [/omnisnippet/i, /omnisrc\.com/i, /omnisend\.com/i],
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    category: "email",
    patterns: [/chimpstatic\.com/i, /list-manage\.com/i],
  },
  {
    id: "privy",
    name: "Privy",
    category: "popup",
    patterns: [/widget\.privy\.com/i, /privy\.com\/widget/i],
  },
  {
    id: "attentive",
    name: "Attentive",
    category: "sms",
    patterns: [/cdn\.attn\.tv/i, /attentivemobile/i],
  },
  { id: "postscript", name: "Postscript", category: "sms", patterns: [/postscript\.io/i] },
  { id: "smsbump", name: "Yotpo SMS (SMSBump)", category: "sms", patterns: [/smsbump/i] },
  // Reviews
  { id: "judge-me", name: "Judge.me", category: "reviews", patterns: [/judge\.me/i, /judgeme/i] },
  { id: "loox", name: "Loox", category: "reviews", patterns: [/loox\.io/i] },
  {
    id: "yotpo",
    name: "Yotpo",
    category: "reviews",
    patterns: [/staticw2\.yotpo\.com/i, /cdn-widgetsrepository\.yotpo\.com/i],
  },
  { id: "stamped", name: "Stamped.io", category: "reviews", patterns: [/stamped\.io/i] },
  { id: "okendo", name: "Okendo", category: "reviews", patterns: [/okendo\.io/i] },
  {
    id: "reviews-io",
    name: "REVIEWS.io",
    category: "reviews",
    patterns: [/widget\.reviews\.io/i, /reviewsio/i],
  },
  {
    id: "trustpilot",
    name: "Trustpilot",
    category: "trust",
    patterns: [/widget\.trustpilot\.com/i],
  },
  { id: "kiyoh", name: "Kiyoh", category: "trust", patterns: [/kiyoh\.com/i] },
  {
    id: "webwinkelkeur",
    name: "WebwinkelKeur",
    category: "trust",
    patterns: [/webwinkelkeur\.nl/i],
  },
  {
    id: "trusted-shops",
    name: "Trusted Shops",
    category: "trust",
    patterns: [/widgets\.trustedshops\.com/i],
  },
  {
    id: "feedback-company",
    name: "The Feedback Company",
    category: "trust",
    patterns: [/feedbackcompany\.com/i],
  },
  // Abonnementen
  {
    id: "recharge",
    name: "Recharge",
    category: "subscriptions",
    patterns: [/rechargecdn\.com/i, /rechargepayments\.com/i, /rechargeassets/i],
  },
  {
    id: "seal-subscriptions",
    name: "Seal Subscriptions",
    category: "subscriptions",
    patterns: [/sealsubscriptions/i],
  },
  {
    id: "appstle",
    name: "Appstle Subscriptions",
    category: "subscriptions",
    patterns: [/appstle/i],
  },
  {
    id: "bold",
    name: "Bold Commerce",
    category: "subscriptions",
    patterns: [/boldapps\.net/i, /boldcommerce/i],
  },
  // Upsell & conversie
  {
    id: "vitals",
    name: "Vitals",
    category: "conversion",
    patterns: [/vitals\.vip/i, /appsolve\.io/i],
  },
  { id: "rebuy", name: "Rebuy", category: "upsell", patterns: [/rebuyengine\.com/i] },
  {
    id: "reconvert",
    name: "ReConvert",
    category: "upsell",
    patterns: [/reconvert/i, /stilyoapps/i],
  },
  { id: "zipify", name: "Zipify OneClickUpsell", category: "upsell", patterns: [/zipify/i] },
  {
    id: "frequently-bought",
    name: "Frequently Bought Together",
    category: "upsell",
    patterns: [/codeblackbelt/i],
  },
  { id: "kiwi-sizing", name: "Kiwi Size Chart", category: "conversion", patterns: [/kiwisizing/i] },
  // Page builders
  { id: "pagefly", name: "PageFly", category: "page-builder", patterns: [/pagefly/i] },
  { id: "gempages", name: "GemPages", category: "page-builder", patterns: [/gempages/i] },
  {
    id: "shogun",
    name: "Shogun",
    category: "page-builder",
    patterns: [/getshogun/i, /shogun-frontend/i],
  },
  // Loyalty
  {
    id: "smile",
    name: "Smile.io",
    category: "loyalty",
    patterns: [/cdn\.sweettooth\.io/i, /smile\.io/i],
  },
  { id: "loyaltylion", name: "LoyaltyLion", category: "loyalty", patterns: [/loyaltylion/i] },
  { id: "rivo", name: "Rivo", category: "loyalty", patterns: [/rivo\.io/i] },
  { id: "growave", name: "Growave", category: "loyalty", patterns: [/growave/i] },
  // Support
  {
    id: "gorgias",
    name: "Gorgias",
    category: "support",
    patterns: [/gorgias\.chat/i, /config\.gorgias\.io/i],
  },
  { id: "tidio", name: "Tidio", category: "support", patterns: [/code\.tidio\.co/i] },
  { id: "zendesk", name: "Zendesk", category: "support", patterns: [/static\.zdassets\.com/i] },
  { id: "intercom", name: "Intercom", category: "support", patterns: [/widget\.intercom\.io/i] },
  // Zoeken & filters
  { id: "searchanise", name: "Searchanise", category: "search", patterns: [/searchanise/i] },
  {
    id: "boost-commerce",
    name: "Boost AI Search & Filter",
    category: "search",
    patterns: [/boostcommerce/i, /bc-sf-filter/i],
  },
  { id: "algolia", name: "Algolia", category: "search", patterns: [/algolia(net)?\.(com|net)/i] },
  // Vertaling
  { id: "weglot", name: "Weglot", category: "translation", patterns: [/cdn\.weglot\.com/i] },
  { id: "langify", name: "Langify", category: "translation", patterns: [/langify/i] },
  // Betalen
  {
    id: "klarna-osm",
    name: "Klarna On-site Messaging",
    category: "payments",
    patterns: [/klarnaservices\.com/i, /js\.klarna\.com/i],
  },
  { id: "afterpay", name: "Afterpay / Clearpay", category: "payments", patterns: [/afterpay/i] },
  // Verzending
  { id: "aftership", name: "AfterShip", category: "shipping", patterns: [/aftership/i] },
  // Popups
  { id: "justuno", name: "Justuno", category: "popup", patterns: [/justuno/i] },
  { id: "wisepops", name: "Wisepops", category: "popup", patterns: [/wisepops/i] },
  {
    id: "optinmonster",
    name: "OptinMonster",
    category: "popup",
    patterns: [/optinmonster/i, /omappapi\.com/i],
  },
  // Cookie-consent
  {
    id: "cookiebot",
    name: "Cookiebot",
    category: "consent",
    patterns: [/consent\.cookiebot\.com/i],
  },
  { id: "pandectes", name: "Pandectes GDPR", category: "consent", patterns: [/pandectes/i] },
  // Analytics & pixels
  {
    id: "google-tag-manager",
    name: "Google Tag Manager",
    category: "analytics",
    patterns: [/googletagmanager\.com\/gtm\.js/i],
  },
  {
    id: "google-analytics",
    name: "Google Analytics 4",
    category: "analytics",
    patterns: [/googletagmanager\.com\/gtag\/js/i],
  },
  { id: "hotjar", name: "Hotjar", category: "analytics", patterns: [/static\.hotjar\.com/i] },
  { id: "clarity", name: "Microsoft Clarity", category: "analytics", patterns: [/clarity\.ms/i] },
  { id: "lucky-orange", name: "Lucky Orange", category: "analytics", patterns: [/luckyorange/i] },
  { id: "elevar", name: "Elevar", category: "analytics", patterns: [/getelevar/i] },
  {
    id: "triple-whale",
    name: "Triple Whale",
    category: "analytics",
    patterns: [/triplewhale/i, /triplepixel/i],
  },
  {
    id: "meta-pixel",
    name: "Meta Pixel",
    category: "pixel",
    patterns: [/connect\.facebook\.net\/[^"']*fbevents/i, /fbq\(\s*['"]init/i],
  },
  {
    id: "tiktok-pixel",
    name: "TikTok Pixel",
    category: "pixel",
    patterns: [/analytics\.tiktok\.com/i],
  },
  {
    id: "pinterest-tag",
    name: "Pinterest Tag",
    category: "pixel",
    patterns: [/s\.pinimg\.com\/ct/i],
  },
  {
    id: "snap-pixel",
    name: "Snap Pixel",
    category: "pixel",
    patterns: [/sc-static\.net\/scevent/i],
  },
];

/** Geeft de ids van alle herkende apps terug, gesorteerd. */
export function detectApps(
  html: string,
  signatures: readonly AppSignature[] = APP_SIGNATURES,
): string[] {
  return signatures
    .filter((s) => s.patterns.some((p) => p.test(html)))
    .map((s) => s.id)
    .sort();
}
