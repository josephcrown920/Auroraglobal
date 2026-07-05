import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Shared `accept` value for every audio-upload `<input type="file">` /
 * DropSlot in the app. `audio/*` alone under-matches some browsers/OSes for
 * less common containers, so we also list explicit extensions. Keep every
 * audio upload site on this constant instead of a local literal — that's how
 * a codec gets silently dropped from one page but not another.
 */
export const AUDIO_ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.opus,.aiff,.webm";
