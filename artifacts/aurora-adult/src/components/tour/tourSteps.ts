// 15-step onboarding tour data. Each step declares which top-level view it
// needs (App.tsx drives navigation before showing the step's card) plus an
// optional data-tour target to spotlight.
export type TourView = "grid" | "canvas" | "connect";

export interface TourStep {
  view: TourView;
  title: string;
  body: string;
  target?: string; // matches a [data-tour="..."] attribute to spotlight
}

export const TOUR_STEPS: TourStep[] = [
  { view: "grid", title: "Welcome to Adult School", body: "This is your private creative studio. Every render here is tied to your account and only visible to you." },
  { view: "grid", title: "Your influencer roster", body: "These are the shared characters you can generate with. Each one keeps a consistent face across every shot." },
  { view: "grid", title: "Pick a character", body: "Open any card to jump into that character's studio, or head straight to the Canvas to plan a full shoot." },
  { view: "grid", title: "Introducing the Canvas", body: "The Canvas is a visual workspace — think of it as a whiteboard where every shot is a card connected to the ones before it.", target: "adult-nav-canvas" },
  { view: "canvas", title: "This is the Canvas", body: "Pan and zoom around your shoot. Each card is one generated image or video, linked by lineage lines to what it came from." },
  { view: "canvas", title: "Start with one character", body: "The example workflow starts from a single reference photo — everything downstream keeps that same face." },
  { view: "canvas", title: "The toolbar", body: "Use the left-side toolbar to add a new step, undo, or redo. It always adds relative to what's selected.", target: "add-step-toolbar" },
  { view: "canvas", title: "Branch from any shot", body: "Hover a card and drag from its right edge onto empty space to branch a new look from it — or click the + that appears." },
  { view: "canvas", title: "Two branches, one character", body: "The example shows two outfit branches running in parallel from the same reference — perfect for planning a full content drop." },
  { view: "canvas", title: "Turn a shot into video", body: "Any finished image card can become a short video in one click — the identity carries over automatically." },
  { view: "canvas", title: "Meet the Assistant", body: "Instead of clicking through menus, just describe what you want.", target: "assistant-button" },
  { view: "canvas", title: "Try plain English", body: "Type something like \"create 4 beach shots of @yuki\" or \"turn this into a video\" — the Assistant builds the Canvas nodes for you." },
  { view: "canvas", title: "Image, video, or upscale", body: "Switch tabs above the Canvas to change what a new step will generate — Motion Control is coming soon.", target: "canvas-tabs" },
  { view: "connect", title: "Use it from anywhere", body: "Adult School has a real MCP connector — plug it into Claude, Cursor, or any MCP-aware client to generate without opening the browser." },
  { view: "connect", title: "You're ready", body: "Copy your connector URL, grab an API key from Aurora, and start creating. You can reopen this tour any time from your account menu." },
];
