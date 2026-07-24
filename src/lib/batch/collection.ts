// Batch collection model — a named set of batch generation results.

export type BatchItem = {
  /** index within the batch (0-based) */
  index: number;
  /** generation row id (uuid) */
  generationId: string;
  /** public result URL */
  url: string;
  /** the prompt variant used for this item */
  prompt: string;
  /** style blueprint applied, if any */
  blueprintId?: string;
};

export type BatchCollection = {
  id: string;
  name: string;
  /** base prompt used for the whole batch */
  basePrompt: string;
  /** style blueprint id applied, if any */
  blueprintId?: string;
  items: BatchItem[];
  createdAt: string;
};

/** Return the collection's items sorted by index. */
export function sortedItems(col: BatchCollection): BatchItem[] {
  return [...col.items].sort((a, b) => a.index - b.index);
}

/** Build a minimal in-memory collection from raw generation results. */
export function makeCollection(
  name: string,
  basePrompt: string,
  results: Array<{ generationId: string; url: string; prompt: string }>,
  blueprintId?: string,
): BatchCollection {
  return {
    id: crypto.randomUUID(),
    name,
    basePrompt,
    blueprintId,
    items: results.map((r, i) => ({
      index: i,
      generationId: r.generationId,
      url: r.url,
      prompt: r.prompt,
      blueprintId,
    })),
    createdAt: new Date().toISOString(),
  };
}
