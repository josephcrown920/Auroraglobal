import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CLAUDE_MODEL = "claude-haiku-4-5";

export type StyleBlueprint = {
  editingRhythm: string;
  cameraStyle: string;
  colorGrade: string;
  captionStyle: string;
  transitionStyle: string;
  tone: string;
  hookStyle: string;
  visualPacing: string;
  brandKeywords: string[];
};

const PLATFORM_MODIFIERS: Record<string, string> = {
  tiktok: "9:16 vertical, hook in first 2 seconds, scroll-stopping energy, trending audio-ready",
  instagram: "9:16 vertical or 1:1 square, polished aesthetic, lifestyle-forward, visually clean",
  youtube_shorts: "9:16 vertical, clear narrative arc, educational or entertainment hook",
  facebook: "16:9 landscape or square, emotionally resonant, community-feel",
  x: "16:9 punchy, immediate visual impact, shareable moment, fast information",
  linkedin: "16:9 professional, thought leadership angle, clean studio aesthetic, authoritative",
};

const STRATEGY_ANGLES: Record<string, string[]> = {
  hooks: [
    "Hook: pattern interrupt — subject does something unexpected in first 2 seconds, tight close-up, fast zoom",
    "Hook: bold statement — subject looks directly at camera with intense expression, slow push-in, high contrast",
    "Hook: visual shock — dramatic reveal or transformation, slow-mo cut to fast pace",
    "Hook: curiosity gap — scene that makes viewer ask 'what happens next?', half-reveal framing",
    "Hook: social proof — confident entrance, camera at low angle looking up, power position",
    "Hook: energy spike — kinetic handheld movement, urban backdrop, maximum intensity",
    "Hook: intimate — extreme close-up of product or subject's eyes, whisper tension",
    "Hook: contrast — before/after split implication, clean studio vs gritty real world",
    "Hook: authority — confident pose with b-roll cutaway, documentary style",
    "Hook: humor — unexpected comedic moment, perfect cut timing, wide then close-up",
    "Hook: mystery — blurred subject slowly revealed, ambient low light, cinematic lens flare",
    "Hook: action — subject mid-movement, freeze frame then burst, kinetic energy",
    "Hook: comparison — two simultaneous visual tracks, side perspective, synchronized",
    "Hook: sound-driven — beat drop implied by visual cut, sudden bright reveal",
    "Hook: text-teaser — 3-word bold statement implied by subject expression, direct gaze",
    "Hook: aesthetic pull — hyper-stylized color grade, slow-motion luxury feel, aspirational",
    "Hook: testimonial cold-open — real-talk direct address, natural light, authentic setting",
    "Hook: product reveal — hand removing cover or packaging, clean overhead light",
    "Hook: challenge accepted — confident nod to camera, competitive implied energy",
    "Hook: nostalgia — warm analog look, slightly overexposed, emotional resonance",
    "Hook: sensory — texture macro shot then pull-back reveal, satisfying visual",
    "Hook: authority disruption — formal setting broken by casual confident subject",
    "Hook: day-one energy — sunrise establishing, subject determined walk, golden light",
    "Hook: problem first — frustrated relatable moment, then confident solution implied",
    "Hook: celebrity angle — aspirational lifestyle arrival, slow-pan across environment",
    "Hook: ASMR trigger — super close-up with implied sound texture, slow reveal",
    "Hook: behind-scenes cold open — camera catches subject unaware, authentic pull",
    "Hook: montage opener — rapid 5-frame context burst then hold on subject",
    "Hook: transformation tease — partial reveal of end result, curiosity-building",
    "Hook: data drop — subject holds up visual stat, confident delivery, clean bg",
    "Hook: crowd reaction — implied social proof of many people, then focus on subject",
  ],
  ctas: [
    "CTA: direct point — subject points straight at lens 'you should try this', bright daylight",
    "CTA: demonstration — product working or result achieved, clean lifestyle shot",
    "CTA: social proof stack — rapid win-montage cuts, energetic pace, warm grade",
    "CTA: urgency — subject with urgent expression holds product, golden hour glow",
    "CTA: community invite — welcoming open gesture to camera, warm indoor light",
    "CTA: challenge drop — subject performs action and dares viewer, high energy",
    "CTA: transformation promise — confident after-pose, aspirational mood",
    "CTA: behind-scenes pull — camera pulls back to reveal 'authentic' making-of",
    "CTA: exclusive whisper — premium setting, subject whispers directly to camera",
    "CTA: endorsement — handheld selfie style, eye contact, real environment",
    "CTA: limited time implied — subject checks watch / phone, urgency without saying it",
    "CTA: question to viewer — subject asks rhetorical question then holds gaze, pause",
    "CTA: result showcase — final product/outcome displayed proudly, clean studio",
    "CTA: dual benefit — split second shows two outcomes simultaneously",
    "CTA: simplicity sell — 'it's this easy' subject demonstrates single effortless step",
    "CTA: social swap — shows viewer what their life looks like before vs after",
    "CTA: authority sign-off — credible-looking subject gives nod of approval",
    "CTA: FOMO moment — implied crowd enjoying product while viewer watches",
    "CTA: gift angle — 'perfect for someone you know' — product held out like offering",
    "CTA: countdown energy — visual implies 'act now', subject animated excitement",
    "CTA: tutorial end — 'now you try' final frame, subject gestures to viewer",
    "CTA: reaction shot — genuine emotion of seeing/using result, authentic delight",
    "CTA: collab angle — two creators sharing product, friendship dynamic",
    "CTA: loyalty appeal — 'been using this for X years' long-term trust implied",
    "CTA: comparison close — side-by-side then clean single winner shot",
    "CTA: celebration — product in context of achievement, confetti energy",
    "CTA: problem solved — relief expression after solution found, exhale moment",
    "CTA: unboxing final — last item revealed, face lights up, genuine reaction",
    "CTA: next step clear — subject points to implied next action, confident smile",
    "CTA: love it close — subject hugs/holds product with genuine affection",
    "CTA: value anchor — implied premium quality in budget-friendly frame",
  ],
  openings: [
    "Opening: wide establishing shot pulling into subject, cinematic scope",
    "Opening: extreme close-up product detail then reveal pull-back, mystery build",
    "Opening: split-screen entry — subject walks in from both sides simultaneously",
    "Opening: top-down descend to subject, lifestyle location bird's-eye",
    "Opening: silhouette against backlit window then steps forward into light",
    "Opening: fast-forward time-lapse then subject enters static frame",
    "Opening: match cut from abstract texture to product surface, satisfying",
    "Opening: whip-pan from environment to isolated subject focus",
    "Opening: bokeh blur pull-to-focus reveal of product in center frame",
    "Opening: candid-style — camera catches subject mid-action, unaware feel",
    "Opening: title card implied — black frame then explosive reveal of subject",
    "Opening: chase cam — following subject from behind, sense of motion",
    "Opening: product POV — camera IS the product, subject's face reacting to it",
    "Opening: crowd disperses then subject emerges, spotlight framing",
    "Opening: slow zoom from distance, subject in environment, building intimacy",
    "Opening: clock or timer visual implication, urgency from frame 1",
    "Opening: hand reaches into frame placing product, stop-motion feel",
    "Opening: upside-down or unusual angle then rotates to normal, disorienting hook",
    "Opening: weather event establishing then shelter/warmth reveal inside",
    "Opening: before-chaos establishing, then subject brings order and calm",
    "Opening: long corridor or hallway walk toward camera, building tension",
    "Opening: product uncover — fabric or packaging dramatically removed",
    "Opening: reflection in surface then turn to face camera, dual perspective",
    "Opening: burst of color — neutral scene then vibrant saturated reveal",
    "Opening: voice-over implied — subject's lips barely moving, mystery",
    "Opening: architect POV — blueprint or plan shown then real-world match",
    "Opening: waking up moment — groggy then energized by product interaction",
    "Opening: nature to urban transition — forest sounds then city cut",
    "Opening: hands at work then reveal of finished result, craft pride",
    "Opening: fan-art energy — dramatic pose then natural personality break",
    "Opening: stack reveal — products stacked then toppled for attention",
  ],
  story: [
    "Story: problem-agitate-solve — chaotic scene, frustrated expression, product resolution",
    "Story: transformation arc — dull start, struggle midpoint, triumphant finish",
    "Story: day-in-the-life — morning routine with product naturally integrated",
    "Story: origin story — intimate flashback visual style, present-day result",
    "Story: comparison journey — two parallel paths shown side-by-side",
    "Story: expert tutorial — step 1-2-3 clean cuts, confident presenter",
    "Story: documentary truth — raw handheld, natural light, authentic emotion",
    "Story: aspirational future — struggle → product → lifestyle montage",
    "Story: community story — multiple people using same product, rapid cuts",
    "Story: myth-busting — debunks misconception, b-roll evidence, confident tone",
    "Story: underdog wins — small effort with product → impressive result reveal",
    "Story: side effect reveal — product used normally, unexpected bonus noticed",
    "Story: time collapse — months of progress in 15 seconds, milestone markers",
    "Story: fail-then-succeed — first attempt fails without product, succeeds with",
    "Story: discovery moment — stumbling upon solution, genuine surprise reaction",
    "Story: shared experience — creator and viewer in same situation, empathy",
    "Story: expert vs novice — quick before/after of skill level with product use",
    "Story: behind the scenes — raw process of creation with product central",
    "Story: trust build — layered evidence accumulates across story beats",
    "Story: last resort — 'tried everything else' desperation then solution found",
    "Story: return visit — 'I came back because of this' loyalty story",
    "Story: accidental discovery — wasn't looking for it, found it anyway moment",
    "Story: challenge completion — 30-day challenge compressed into visual arc",
    "Story: family integration — product woven into family moment, emotion",
    "Story: pro tip reveal — 'most people don't know this' insider knowledge",
    "Story: resistance overcome — initial skepticism → genuine conversion",
    "Story: anniversary celebration — product has been part of milestone",
    "Story: collaboration origin — two people, shared product, new friendship",
    "Story: season shift — product in each season context, time passage",
    "Story: morning vs night — product spans full day routine naturally",
    "Story: before i found this — clearly worse situation vs now contrast",
  ],
  captions: [
    "Caption-drive: bold subtitle style, text fills bottom third, subject speaks to camera",
    "Caption-drive: word-by-word kinetic text, fast speech rhythm visual sync",
    "Caption-drive: headline hook text on lifestyle b-roll, minimal presenter",
    "Caption-drive: Q&A format — question on screen, subject answers directly",
    "Caption-drive: stat callout — numbers appear large on screen during speech",
    "Caption-drive: listicle — numbered points appear as subject ticks them off",
    "Caption-drive: emoji-forward — playful icons accent spoken words visually",
    "Caption-drive: irony contrast — text says one thing, visual implies another",
    "Caption-drive: scroll-stopper text — opening 3 words huge on black bg, then reveal",
    "Caption-drive: whisper secret — intimate close-up, captions carry full weight",
    "Caption-drive: reaction text — subjective commentary overlaid on objective visual",
    "Caption-drive: hashtag integration — trending tag appears naturally in text flow",
    "Caption-drive: split-screen text — caption on left, visual evidence on right",
    "Caption-drive: countdown overlay — numbers counting down to product reveal",
    "Caption-drive: question chain — rapid questions appear, subject nods to each",
    "Caption-drive: translation mode — subject speaks, captions 'translate' to benefit",
    "Caption-drive: myth-label — 'MYTH' then 'TRUTH' large text with cuts",
    "Caption-drive: highlight reel — each sentence gets a visual proof cut-away",
    "Caption-drive: feature callout — arrows or labels appear on product during demo",
    "Caption-drive: comparison text — split labels of before vs after on visual",
    "Caption-drive: step-by-step — 'Step 1', 'Step 2' overlaid on tutorial action",
    "Caption-drive: quote card — key phrase isolated on clean bg, then back to subject",
    "Caption-drive: poll format — 'Which would you choose?' options appear on screen",
    "Caption-drive: percentage stat — '87% of users say...' bold claim with visual",
    "Caption-drive: time stamp — 'Week 1 / Week 4 / Week 8' progression markers",
    "Caption-drive: warning label — playful 'WARNING: may cause...' hook opener",
    "Caption-drive: price reveal — cost appears at key moment, value-anchored",
    "Caption-drive: title card — chapter-style titles between segments",
    "Caption-drive: reaction emoji — large emoji appears synced to subject reaction",
    "Caption-drive: thought bubble — internal monologue text while subject acts",
    "Caption-drive: brand story — company name/date appears at emotional peak",
  ],
  mixed: [
    "Hook: pattern interrupt close-up, fast zoom-in, maximum scroll-stop energy",
    "Testimonial: authentic creator hold-to-camera excitement, handheld slight shake",
    "Lifestyle: product naturally in cinematic scene — cafe/rooftop/gym — golden hour",
    "Dramatic hero: low-angle studio or neon backlighting, slow orbit, cinematic dark",
    "POV action: first-person perspective using or unboxing product, hands in frame",
    "Street energy: walking shot, busy urban backdrop, handheld kinetic camera",
    "Story arc: problem → product → transformation, three-act visual structure",
    "CTA direct: subject points to lens with urgency, bright confident lighting",
    "Social proof: rapid result-wins montage, high energy pace",
    "Behind-scenes: authentic making-of reveal, camera pull-back, real location",
    "Authority: confident product demonstration, clean studio, editorial grade",
    "Community: multiple users shown loving product, warm diverse casting",
    "Emotion peak: genuine reaction to result, close-up face, natural light",
    "Challenge: subject dares viewer to try, competitive playful energy",
    "Tutorial: step-by-step clean cuts, informative and confident presenter",
    "Aspirational: luxury lifestyle context, product as status signal",
    "Relatable: everyday chaotic moment, product as saving grace",
    "Unboxing: premium reveal, hands in frame, tactile detail focus",
    "Myth-bust: misconception then confident truth reveal, direct address",
    "Transformation: before/after with dramatic visual shift, satisfying payoff",
    "Discovery: stumbling-upon-it authenticity, genuine surprise expression",
    "Loyalty: long-term use implied, trusted companion angle",
    "Innovation: product doing something surprising, technology awe moment",
    "Value: 'you won't believe the price' tension then confident smile",
    "FOMO: crowd enjoying product, viewer feels left out, invitation to join",
    "Educational: 'most people don't know this' insider knowledge share",
    "Collaboration: two creators, shared product, energy of friendship",
    "Season: product in beautiful seasonal context, timeless lifestyle",
    "Morning routine: product woven into aspirational morning ritual",
    "Celebration: product at center of milestone achievement, joy",
    "Last resort: everything else failed, this worked, relief expression",
  ],
};

const BASE_SYSTEM = `You are a viral video prompt engineer specializing in social media content.

Rules:
- Each prompt must be 1-2 sentences, vivid and specific.
- Start with describing the SUBJECT's action/motion.
- Include camera movement (push-in / orbit / zoom / handheld / static).
- Include mood/lighting (golden hour / neon-lit / dramatic dark / clean studio).
- No text overlays. No brand logos in prompt.
- Keep each prompt under 80 words.
- Output ONLY a JSON array of strings — no explanation, no markdown fences.`;

async function callClaude(
  productDescription: string,
  count: number,
  strategy: string,
  platform: string,
): Promise<string[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Anthropic API key not configured. Add ANTHROPIC_API_KEY to your secrets.");

  const allAngles = STRATEGY_ANGLES[strategy] ?? STRATEGY_ANGLES.mixed;
  const angles = allAngles.slice(0, count);
  const platformNote = PLATFORM_MODIFIERS[platform]
    ? `\nPlatform: ${PLATFORM_MODIFIERS[platform]}`
    : "";

  const userMsg = [
    `Product/Subject: "${productDescription}"${platformNote}`,
    "",
    `Generate exactly ${count} distinct Seedance video prompts, one per angle:`,
    ...angles.map((a, i) => `${i + 1}. ${a}`),
    "",
    `Output a JSON array with exactly ${count} strings.`,
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: BASE_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const json = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = json.content?.find((c) => c.type === "text")?.text ?? "";
  if (!text) throw new Error("Claude returned an empty response");

  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Claude didn't return a JSON array — try again.");

  let prompts: string[];
  try {
    prompts = JSON.parse(cleaned.slice(start, end + 1)) as string[];
  } catch {
    throw new Error("Failed to parse Claude's response as JSON. Try again.");
  }

  if (!Array.isArray(prompts) || prompts.length === 0) {
    throw new Error("Claude returned an empty list of prompts.");
  }

  return prompts.slice(0, count);
}

export const generateProductVideoHooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      productDescription: z.string().min(3).max(500),
      count: z.number().int().min(1).max(30).default(5),
      strategy: z.string().default("mixed"),
      platform: z.string().default("tiktok"),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ prompts: string[] }> => {
    const prompts = await callClaude(
      data.productDescription,
      data.count,
      data.strategy,
      data.platform,
    );
    return { prompts };
  });

export const generateStyleBlueprint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      description: z.string().min(3).max(1000),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ blueprint: StyleBlueprint }> => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Anthropic API key not configured.");

    const systemPrompt = `You are a video style analyst. Output a style blueprint as valid JSON only. No markdown, no explanation.`;

    const userMsg = `Content description: "${data.description}"

Output a JSON object with exactly these fields:
{
  "editingRhythm": "fast-cut | slow-burn | medium | rhythmic",
  "cameraStyle": "handheld | static | dynamic-orbit | mixed",
  "colorGrade": "warm-golden | cool-cinematic | high-contrast | natural | neon-punchy | desaturated",
  "captionStyle": "bold-subtitle | kinetic-text | minimal | none",
  "transitionStyle": "hard-cut | dissolve | whip-pan | match-cut | smash-cut",
  "tone": "energetic | professional | intimate | humorous | dramatic | aspirational",
  "hookStyle": "visual-shock | question-hook | bold-statement | curiosity-gap | social-proof",
  "visualPacing": "fast (0-3s clips) | medium (3-6s clips) | slow (6s+ clips)",
  "brandKeywords": ["word1", "word2", "word3"]
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API error ${res.status}`);

    const json = await res.json() as { content: Array<{ type: string; text: string }> };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Claude didn't return valid JSON for blueprint");

    const blueprint = JSON.parse(cleaned.slice(start, end + 1)) as StyleBlueprint;
    return { blueprint };
  });
