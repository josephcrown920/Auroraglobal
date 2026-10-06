/**
 * Deterministic claim audit for Aurora Marketing Studio output.
 *
 * The campaign LLM is told to stay inside the approved catalog facts, but a
 * prompt is not a guarantee. This audit catches the classes of claim that
 * cannot be true of the catalog (competitor/third-party names, invented
 * metrics and social proof, availability/pricing promises) so the server can
 * ask for a rewrite or refuse the campaign instead of shipping the copy.
 *
 * Pure and client-safe: no server imports.
 */

export type ClaimAuditItem = {
  title: string;
  format: string;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  slides: Array<{ heading: string; body: string }>;
};

export type ClaimAuditCampaign = {
  name: string;
  strategy: string;
  items: ClaimAuditItem[];
};

/** Third-party products Aurora copy must never name or compare against. */
const THIRD_PARTY_NAMES =
  /\b(runway(?:ml)?|pika(?:\s*labs)?|sora|kling|midjourney|higgsfield|veo\s*\d?|luma|hailuo|minimax|capcut|canva|adobe|premiere|after\s*effects|final\s*cut|davinci|photoshop|firefly|stable\s*diffusion|leonardo\.?ai|heygen|synthesia|elevenlabs|chatgpt|openai|gemini|claude)\b/i;

/** Invented performance, scale or social-proof claims. */
const INVENTED_METRICS =
  /(\b\d+(?:\.\d+)?\s*(?:%|percent)\s+(?:faster|quicker|more|less|fewer|of|increase|growth|cheaper|better|higher|lower)\b|\b\d+(?:\.\d+)?\s*[x×]\s*(?:faster|quicker|more|better|cheaper)\b|\b\d[\d,.]*\s*(?:k|m|million|billion)\+?\s+(?:users|creators|artists|videos|downloads|views|customers)\b|\b(?:#\s?1|number\s+one|world'?s\s+(?:first|best|fastest|most)|award[- ]winning|trusted\s+by|as\s+seen\s+(?:in|on)|rated\s+\d|5[- ]star|testimonial)\b)/i;

/** Pricing, availability and guarantee promises the catalog does not make. */
const UNAPPROVED_PROMISES =
  /\b(free\s+forever|unlimited|no\s+limits?|lifetime\s+(?:access|deal)|money[- ]back|guarantee[ds]?|risk[- ]free|100%\s+(?:accurate|realistic|identical)|4k|8k|real[- ]time|instant(?:ly)?\s+(?:render|generat)|coming\s+soon|now\s+available\s+on\s+(?:ios|android|the\s+app\s+store|google\s+play)|integrat(?:es|ed|ion)\s+with)\b/i;

const RULES: Array<{ label: string; pattern: RegExp }> = [
  { label: "names a third-party product", pattern: THIRD_PARTY_NAMES },
  { label: "invents a metric or social proof", pattern: INVENTED_METRICS },
  { label: "makes an unapproved promise", pattern: UNAPPROVED_PROMISES },
];

function auditText(where: string, text: string, out: string[]) {
  for (const rule of RULES) {
    const match = rule.pattern.exec(text);
    if (match) out.push(`${where} ${rule.label}: "${match[0].trim()}"`);
  }
}

/**
 * Returns a list of human-readable violations (empty when the campaign is
 * clean). Each entry names the field and the offending fragment so it can be
 * fed straight back to the model as a correction or shown to the operator.
 */
export function auditMarketingCampaignClaims(
  campaign: ClaimAuditCampaign,
  options: { allowedFormats?: ReadonlySet<string> } = {},
): string[] {
  const issues: string[] = [];
  auditText("campaign name", campaign.name, issues);
  auditText("strategy", campaign.strategy, issues);
  campaign.items.forEach((item, index) => {
    const where = `item ${index + 1} ("${item.title}")`;
    if (options.allowedFormats && !options.allowedFormats.has(item.format)) {
      issues.push(`${where} uses format "${item.format}" which is not in the brief`);
    }
    auditText(`${where} title`, item.title, issues);
    auditText(`${where} hook`, item.hook, issues);
    auditText(`${where} caption`, item.caption, issues);
    auditText(`${where} cta`, item.cta, issues);
    auditText(`${where} hashtags`, item.hashtags.join(" "), issues);
    item.slides.forEach((slide, slideIndex) => {
      auditText(`${where} slide ${slideIndex + 1}`, `${slide.heading} ${slide.body}`, issues);
    });
  });
  return issues;
}
