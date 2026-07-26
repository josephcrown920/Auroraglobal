// Simple localStorage-backed store for prompts, gallery items, references.
// Zero-backend v1 — easy to migrate to Lovable Cloud later.

export type GalleryItem = {
  id: string;
  prompt: string;
  dataUrl: string;
  createdAt: number;
  kind: "image" | "video";
};

export type PromptItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  favorite: boolean;
  createdAt: number;
};

export type ReferenceItem = {
  id: string;
  name: string;
  dataUrl: string;
  mime: string;
  tags: string[];
  createdAt: number;
};

const K = {
  gallery: "studio.gallery.v1",
  prompts: "studio.prompts.v1",
  refs: "studio.refs.v1",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("studio-store write failed", err);
  }
}

export const gallery = {
  list: (): GalleryItem[] => read<GalleryItem[]>(K.gallery, []),
  add: (item: GalleryItem) => {
    const list = gallery.list();
    write(K.gallery, [item, ...list].slice(0, 200));
  },
  remove: (id: string) => write(K.gallery, gallery.list().filter((i) => i.id !== id)),
  clear: () => write(K.gallery, []),
};

export const prompts = {
  list: (): PromptItem[] => read<PromptItem[]>(K.prompts, []),
  save: (item: PromptItem) => {
    const list = prompts.list().filter((p) => p.id !== item.id);
    write(K.prompts, [item, ...list]);
  },
  remove: (id: string) => write(K.prompts, prompts.list().filter((p) => p.id !== id)),
  import: (items: PromptItem[]) => write(K.prompts, [...items, ...prompts.list()]),
};

export const refs = {
  list: (): ReferenceItem[] => read<ReferenceItem[]>(K.refs, []),
  add: (item: ReferenceItem) => write(K.refs, [item, ...refs.list()].slice(0, 100)),
  remove: (id: string) => write(K.refs, refs.list().filter((r) => r.id !== id)),
};

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
