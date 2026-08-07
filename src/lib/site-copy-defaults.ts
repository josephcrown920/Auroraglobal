/**
 * Canonical list of every editable copy key Aurora ships with.
 *
 * SITE_COPY_DEFAULTS   — the hardcoded fallback text (what renders when no DB
 *                         override exists).  Keep in sync with the JSX in
 *                         index.tsx and home.lazy.tsx.
 * SITE_COPY_LABELS     — human-readable label shown in the admin panel.
 * SITE_COPY_SECTIONS   — group name for the admin panel table.
 */

export const SITE_COPY_DEFAULTS: Record<string, string> = {
  // ── Landing hero — slide 0 (Flagship) ────────────────────────────────────
  landing_hero_0_headline:  "Film Yourself. Aurora Builds the World.",
  landing_hero_0_sub:       "Aurora's Motion Control reads your real performance from a 30-second phone clip and places you in any cinematic scene on earth — style, motion, energy intact. No studio. No crew. No budget.",
  landing_hero_0_cta:       "Perform From Anywhere →",

  // ── Landing hero — slide 1 (TikTok30) ────────────────────────────────────
  landing_hero_1_headline:  "One Prompt. 30 Posts. Posted.",
  landing_hero_1_sub:       "Type your hook. Aurora uses Claude + Seedance 2.0 to generate 30 scroll-stopping posts — lyric hooks, cover reveals, performance clips, styled portraits — a full month of content from one idea.",
  landing_hero_1_cta:       "Launch TikTok30 Free →",

  // ── Landing hero — slide 2 (Colors) ──────────────────────────────────────
  landing_hero_2_headline:  "One Recording. Infinite Colors.",
  landing_hero_2_sub:       "Record 30 seconds on your phone. Pick a color palette. Pick an outfit. Aurora delivers unlimited cinematic content — on demand, every drop.",
  landing_hero_2_cta:       "Start Colors Studio Free →",

  // ── Landing hero — slide 3 (Press Ready) ─────────────────────────────────
  landing_hero_3_headline:  "$50K Look. Zero Crew.",
  landing_hero_3_sub:       "Studio-grade press photos and tour visuals. Shot on your phone. Delivered in minutes.",
  landing_hero_3_cta:       "Get Press-Ready Now →",

  // ── Landing — process section ─────────────────────────────────────────────
  landing_process_heading:  "Reference. Direction. Delivered.",
  landing_process_sub:      "Three steps between the sound in your head and the visual on your feed.",

  // ── Landing — featured tools section ─────────────────────────────────────
  landing_tools_heading:    "The full studio.",
  landing_tools_subheading: "Pay only for what you make.",
  landing_tools_blurb:      "Every feature is credit based. No subscriptions required to start. 5 free Aura on signup.",

  // ── Landing — gallery section ─────────────────────────────────────────────
  landing_gallery_heading:  "Real artists. Real outputs. Zero stock.",
  landing_gallery_sub:      "A curated feed of recent generations across covers, promo, and motion.",

  // ── Home dashboard ────────────────────────────────────────────────────────
  home_artist_heading:      "Artist tools",
  home_creator_heading:     "Creator tools",
  home_artist_tab_sub:      "Press shots · Music videos · Live visuals",
  home_creator_tab_sub:     "UGC ads · Short-form · Avatars",
  home_composer_placeholder: "Describe what you want to make…",

  // ── Studio ────────────────────────────────────────────────────────────────
  studio_hero_kicker:      "Aurora Studio",
  studio_hero_headline:    "MAKE VIDEOS IN ONE CLICK",
  studio_hero_description: "From a selfie to a cinematic AI video. Upload your photo, describe your vision, and watch it come to life.",
  studio_empty_state:      "Upload your photo above, then hit Generate",
  studio_gallery_label:    "STYLE GALLERY",

  // ── Music Video ────────────────────────────────────────────────────────────
  music_video_header_title: "Music Video Studio",
  music_video_mode_heading: "What to create",
  music_video_generate_cta: "Generate",

  // ── UGC ───────────────────────────────────────────────────────────────────
  ugc_hero_kicker:         "UGC Factory",
  ugc_hero_headline:       "Pick an avatar. Ship UGC.",
  ugc_hero_description:    "Six on-brand AI creators, ready to film. Choose a face, pick a scene, and Aurora generates a native TikTok-style ad with your product in hand.",
  ugc_avatar_heading:      "1. Choose your avatar",
  ugc_prompt_heading:      "3. Describe the product / action",
  ugc_generate_shot_cta:   "Generate UGC shot",
  ugc_animate_cta:         "Animate",
  ugc_talking_ad_cta:      "Generate talking ad",
};

export const SITE_COPY_LABELS: Record<string, string> = {
  landing_hero_0_headline:  "Hero slide 1 — headline",
  landing_hero_0_sub:       "Hero slide 1 — subtext",
  landing_hero_0_cta:       "Hero slide 1 — CTA link",
  landing_hero_1_headline:  "Hero slide 2 — headline",
  landing_hero_1_sub:       "Hero slide 2 — subtext",
  landing_hero_1_cta:       "Hero slide 2 — CTA link",
  landing_hero_2_headline:  "Hero slide 3 — headline",
  landing_hero_2_sub:       "Hero slide 3 — subtext",
  landing_hero_2_cta:       "Hero slide 3 — CTA link",
  landing_hero_3_headline:  "Hero slide 4 — headline",
  landing_hero_3_sub:       "Hero slide 4 — subtext",
  landing_hero_3_cta:       "Hero slide 4 — CTA link",
  landing_process_heading:  "Process section — heading",
  landing_process_sub:      "Process section — subtext",
  landing_tools_heading:    "Tools section — main heading",
  landing_tools_subheading: "Tools section — sub heading",
  landing_tools_blurb:      "Tools section — blurb",
  landing_gallery_heading:  "Gallery section — heading",
  landing_gallery_sub:      "Gallery section — subtext",
  home_artist_heading:      "Home — Artist tools heading",
  home_creator_heading:     "Home — Creator tools heading",
  home_artist_tab_sub:      "Home — Artist tab subtitle",
  home_creator_tab_sub:     "Home — Creator tab subtitle",
  home_composer_placeholder: "Home — composer placeholder text",
  studio_hero_kicker:       "Studio — hero kicker",
  studio_hero_headline:     "Studio — hero headline",
  studio_hero_description:  "Studio — hero description",
  studio_empty_state:       "Studio — empty canvas message",
  studio_gallery_label:     "Studio — gallery label",
  music_video_header_title: "Music Video — page title",
  music_video_mode_heading: "Music Video — mode heading",
  music_video_generate_cta: "Music Video — generate button",
  ugc_hero_kicker:          "UGC — hero kicker",
  ugc_hero_headline:        "UGC — hero headline",
  ugc_hero_description:     "UGC — hero description",
  ugc_avatar_heading:       "UGC — avatar section heading",
  ugc_prompt_heading:       "UGC — prompt section heading",
  ugc_generate_shot_cta:    "UGC — generate shot button",
  ugc_animate_cta:          "UGC — animate button",
  ugc_talking_ad_cta:       "UGC — talking ad button",
};

export const SITE_COPY_SECTIONS: Record<string, string> = {
  landing_hero_0_headline:  "Landing — Hero slides",
  landing_hero_0_sub:       "Landing — Hero slides",
  landing_hero_0_cta:       "Landing — Hero slides",
  landing_hero_1_headline:  "Landing — Hero slides",
  landing_hero_1_sub:       "Landing — Hero slides",
  landing_hero_1_cta:       "Landing — Hero slides",
  landing_hero_2_headline:  "Landing — Hero slides",
  landing_hero_2_sub:       "Landing — Hero slides",
  landing_hero_2_cta:       "Landing — Hero slides",
  landing_hero_3_headline:  "Landing — Hero slides",
  landing_hero_3_sub:       "Landing — Hero slides",
  landing_hero_3_cta:       "Landing — Hero slides",
  landing_process_heading:  "Landing — Process section",
  landing_process_sub:      "Landing — Process section",
  landing_tools_heading:    "Landing — Tools section",
  landing_tools_subheading: "Landing — Tools section",
  landing_tools_blurb:      "Landing — Tools section",
  landing_gallery_heading:  "Landing — Gallery section",
  landing_gallery_sub:      "Landing — Gallery section",
  home_artist_heading:      "Home dashboard",
  home_creator_heading:     "Home dashboard",
  home_artist_tab_sub:      "Home dashboard",
  home_creator_tab_sub:     "Home dashboard",
  home_composer_placeholder: "Home dashboard",
  studio_hero_kicker:       "Studio",
  studio_hero_headline:     "Studio",
  studio_hero_description:  "Studio",
  studio_empty_state:       "Studio",
  studio_gallery_label:     "Studio",
  music_video_header_title: "Music Video",
  music_video_mode_heading: "Music Video",
  music_video_generate_cta: "Music Video",
  ugc_hero_kicker:          "UGC",
  ugc_hero_headline:        "UGC",
  ugc_hero_description:     "UGC",
  ugc_avatar_heading:       "UGC",
  ugc_prompt_heading:       "UGC",
  ugc_generate_shot_cta:    "UGC",
  ugc_animate_cta:          "UGC",
  ugc_talking_ad_cta:       "UGC",
};
