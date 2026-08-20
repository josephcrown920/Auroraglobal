export type StudioCommand =
  | { type: "prompt"; prompt: string }
  | { type: "render"; prompt: string }
  | { type: "storyboard"; shots: { beat: string; prompt: string; motion?: string }[] }
  | { type: "bible"; kind: string; label: string; detail: string };

const EVENT = "aurora:studio-command";

export function sendStudioCommand(command: StudioCommand, scroll = true) {
  window.dispatchEvent(new CustomEvent<StudioCommand>(EVENT, { detail: command }));
  if (scroll) document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
}

export function onStudioCommand(handler: (command: StudioCommand) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<StudioCommand>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function sendPromptToStudio(prompt: string) {
  sendStudioCommand({ type: "prompt", prompt });
}

/** Back-compat helper for components that only care about prompt hand-offs. */
export function onStudioPrompt(handler: (prompt: string) => void) {
  return onStudioCommand((command) => {
    if (command.type === "prompt" || command.type === "render") handler(command.prompt);
  });
}
