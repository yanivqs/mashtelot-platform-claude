export interface TreeNodeInput {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder?: number;
}

export interface FlatTreeOption {
  id: string;
  name: string;
  depth: number;
}

/** מסדר קטגוריות בעץ (הורה → ילדים) וממיר לרשימה שטוחה עם עומק להזחה בתפריטים. */
export function flattenCategoryTree<T extends TreeNodeInput>(items: T[]): FlatTreeOption[] {
  const byParent = new Map<string | null, T[]>();
  const ids = new Set(items.map((i) => i.id));
  for (const item of items) {
    // הורה שנמחק / לא קיים → מטופל כשורש
    const key = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    const list = byParent.get(key) ?? [];
    list.push(item);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'he'));
  }

  const out: FlatTreeOption[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const node of byParent.get(parent) ?? []) {
      out.push({ id: node.id, name: node.name, depth });
      visit(node.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/** מזהי הקטגוריה עצמה וכל צאצאיה — לסינון "כולל תת-קטגוריות". */
export function categoryAndDescendantIds(
  items: Array<Pick<TreeNodeInput, 'id' | 'parentId'>>,
  rootId: string,
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const item of items) {
    if (!item.parentId) continue;
    const list = childrenOf.get(item.parentId) ?? [];
    list.push(item.id);
    childrenOf.set(item.parentId, list);
  }
  const result = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const current = stack.pop()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    }
  }
  return [...result];
}
