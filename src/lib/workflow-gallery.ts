export type WorkflowOutputNode = {
  id: string;
  data: {
    kind?: string;
    status?: string;
    url?: string;
    altUrl?: string;
    outputKind?: string;
  };
};

export type WorkflowOutputEdge = { source: string };

export type TerminalOutput = { nodeId: string; url: string; kind: "image" | "video" };

/** Returns the last completed leaf which has a usable generated media URL. */
export function selectTerminalOutput(
  nodes: WorkflowOutputNode[],
  edges: WorkflowOutputEdge[],
): TerminalOutput | null {
  const outgoing = new Set(edges.map((edge) => edge.source));
  const terminal = nodes.filter((node) =>
    !outgoing.has(node.id) &&
    node.data.status === "done" &&
    Boolean(node.data.url || node.data.altUrl),
  ).at(-1);
  if (!terminal) return null;
  const kind = terminal.data.outputKind === "video" ||
    ["video", "lipsync", "batchVideo", "heygenTemplate"].includes(terminal.data.kind ?? "")
    ? "video"
    : "image";
  return { nodeId: terminal.id, url: terminal.data.url || terminal.data.altUrl!, kind };
}

export type DatedGalleryItem = { created_at: string };

export function groupGalleryByDate<T extends DatedGalleryItem>(
  items: T[],
  now = new Date(),
): { label: string; items: T[] }[] {
  const start = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = start(now);
  const buckets: Record<string, T[]> = { Today: [], Yesterday: [], "This week": [], Older: [] };
  for (const item of [...items].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))) {
    const day = start(new Date(item.created_at));
    if (day === today) buckets.Today.push(item);
    else if (day === today - 86_400_000) buckets.Yesterday.push(item);
    else if (day >= today - 6 * 86_400_000) buckets["This week"].push(item);
    else buckets.Older.push(item);
  }
  return Object.entries(buckets).filter(([, grouped]) => grouped.length).map(([label, grouped]) => ({ label, items: grouped }));
}