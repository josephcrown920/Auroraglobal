// Aurora AI Intelligence Router — Per-category model chains
// ModelArk leads creative video/image/script reasoning when configured; every
// chain retains fallbacks so adding ModelArk never cancels existing providers.
import type { RequestCategory } from "./categories";
export const CATEGORY_CHAINS:Record<RequestCategory,string[]>={
 GENERAL_CHAT:["modelark","gemini","grok","qwen","deepseek","llama"],
 CUSTOMER_SUPPORT:["gemini","modelark","qwen","llama","claude"],
 FAQ:["gemini","modelark","deepseek","qwen","llama"],
 PRICING:["gemini","modelark","deepseek","qwen"],
 PRODUCT_DISCOVERY:["modelark","gemini","grok","claude","deepseek"],
 VIDEO_DIRECTION:["modelark","claude","gemini","deepseek","qwen","grok"],
 VIDEO_PROMPTS:["modelark","claude","gemini","deepseek","qwen"],
 IMAGE_PROMPTS:["modelark","claude","gemini","deepseek","qwen"],
 SCRIPT_WRITING:["modelark","claude","grok","gemini","deepseek","qwen"],
 MUSIC_MARKETING:["claude","modelark","grok","gemini","deepseek"],
 ARTIST_BRANDING:["modelark","claude","grok","gemini","deepseek"],
 SOCIAL_CONTENT:["modelark","claude","grok","gemini","deepseek"],
 ADVERTISEMENT:["modelark","claude","grok","gemini","deepseek"],
 COPYWRITING:["modelark","claude","gemini","deepseek","grok"],
 LANDING_PAGE:["modelark","claude","gemini","deepseek"],
 BLOG:["modelark","claude","gemini","deepseek"],
 EMAIL_WRITING:["modelark","claude","gemini","deepseek"],
 PLAYLIST_PITCHING:["modelark","claude","grok","gemini","deepseek"],
 CODING:["claude","modelark","qwen-coder","deepseek-coder","gemini","grok"],
 DEBUGGING:["claude","modelark","qwen-coder","deepseek-coder","gemini"],
};
