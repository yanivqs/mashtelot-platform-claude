/** סידור לסירוגין: אחד מכל רשימה בתורו (בלי כפילויות), עד limit. טהור. */
export function interleave<T extends { id: string }>(lists: T[][], limit: number): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const item = l[i];
      if (item && !seen.has(item.id) && out.length < limit) {
        seen.add(item.id);
        out.push(item);
      }
    }
  }
  return out;
}
