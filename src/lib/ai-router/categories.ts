// Aurora AI Intelligence Router — Request Categories
// 20 task types the router classifies every incoming request into.
// Classifying before model selection lets us reserve Claude for creative work
// and Gemini for utility tasks, instead of using one flat chain for everything.

export const REQUEST_CATEGORIES = [
  "GENERAL_CHAT",
  "CUSTOMER_SUPPORT",
  "FAQ",
  "PRICING",
  "VIDEO_DIRECTION",
  "VIDEO_PROMPTS",
  "IMAGE_PROMPTS",
  "SCRIPT_WRITING",
  "MUSIC_MARKETING",
  "ARTIST_BRANDING",
  "SOCIAL_CONTENT",
  "ADVERTISEMENT",
  "COPYWRITING",
  "LANDING_PAGE",
  "BLOG",
  "EMAIL_WRITING",
  "CODING",
  "DEBUGGING",
  "PLAYLIST_PITCHING",
  "PRODUCT_DISCOVERY",
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export type CategoryMeta = {
  label: string;
  description: string;
  tier: "utility" | "creative" | "technical";
};

export const CATEGORY_META: Record<RequestCategory, CategoryMeta> = {
  GENERAL_CHAT: { label: "General Chat", description: "Casual conversation, greetings, general questions", tier: "utility" },
  CUSTOMER_SUPPORT: { label: "Customer Support", description: "Help with the product, troubleshooting, account issues", tier: "utility" },
  FAQ: { label: "FAQ", description: "Frequently asked questions about features and usage", tier: "utility" },
  PRICING: { label: "Pricing", description: "Questions about costs, plans, credits, and billing", tier: "utility" },
  VIDEO_DIRECTION: { label: "Video Direction", description: "Directing and planning cinematic video productions", tier: "creative" },
  VIDEO_PROMPTS: { label: "Video Prompts", description: "Writing prompts for AI video generation", tier: "creative" },
  IMAGE_PROMPTS: { label: "Image Prompts", description: "Writing prompts for AI image generation", tier: "creative" },
  SCRIPT_WRITING: { label: "Script Writing", description: "Writing scripts for videos, ads, or social content", tier: "creative" },
  MUSIC_MARKETING: { label: "Music Marketing", description: "Marketing strategy for music releases", tier: "creative" },
  ARTIST_BRANDING: { label: "Artist Branding", description: "Building an artist's brand identity and visual language", tier: "creative" },
  SOCIAL_CONTENT: { label: "Social Content", description: "Creating posts, captions, and social media content", tier: "creative" },
  ADVERTISEMENT: { label: "Advertisement", description: "Writing ad copy, UGC scripts, and promotional content", tier: "creative" },
  COPYWRITING: { label: "Copywriting", description: "Persuasive copy for any medium", tier: "creative" },
  LANDING_PAGE: { label: "Landing Page", description: "Writing landing page copy and structure", tier: "creative" },
  BLOG: { label: "Blog", description: "Writing blog posts and long-form articles", tier: "creative" },
  EMAIL_WRITING: { label: "Email Writing", description: "Writing email campaigns and newsletters", tier: "creative" },
  CODING: { label: "Coding", description: "Writing or generating code", tier: "technical" },
  DEBUGGING: { label: "Debugging", description: "Diagnosing and fixing code errors", tier: "technical" },
  PLAYLIST_PITCHING: { label: "Playlist Pitching", description: "Pitching music to playlists and curators", tier: "creative" },
  PRODUCT_DISCOVERY: { label: "Product Discovery", description: "Exploring features, use cases, and Aurora capabilities", tier: "utility" },
};
