export function moveTimelineItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function getTimelineDropIndex(sourceIndex: number, targetIndex: number): number {
  return sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
}
