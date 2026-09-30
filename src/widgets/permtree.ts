// Чистая логика виджета TreeBuilder («Ағаш»): дерево выбора для перестановок и пар.
// Узел глубины d — выбор d-го элемента; лист (глубина k) — одна расстановка. Раскладка: листья по строкам, родитель — по середине детей.

export interface TN {
  id: string;           // 'r' — корень, иначе индексы пути через «-»: «0-2-1»
  depth: number;        // 0 — корень
  item: number;         // индекс выбранного элемента (у корня -1)
  path: number[];
  row: number;          // строка (доли строки у внутренних узлов)
  parent: string | null;
  kids: string[];
}
export interface Tree { nodes: TN[]; byId: Map<string, TN>; leaves: number; n: number; k: number }

/** n!/(n−k)!: сколькими способами выбрать и расставить k из n. */
export function permCount(n: number, k: number): number { let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; }
/** n(n−1)/2: пары без порядка. */
export function pairCount(n: number): number { return (n * (n - 1)) / 2; }
/** Сколько вариантов на каждом уровне: [n, n−1, …]. */
export function levelCounts(n: number, k: number): number[] { return Array.from({ length: k }, (_, i) => n - i); }

const idOf = (path: number[]) => (path.length ? path.join('-') : 'r');

export function buildTree(n: number, k: number): Tree {
  const nodes: TN[] = [], byId = new Map<string, TN>();
  let row = 0;
  const walk = (path: number[], parent: string | null): TN => {
    const node: TN = { id: idOf(path), depth: path.length, item: path.length ? path[path.length - 1] : -1, path, row: 0, parent, kids: [] };
    nodes.push(node); byId.set(node.id, node);
    if (path.length === k) { node.row = row++; return node; }
    for (let i = 0; i < n; i++) if (!path.includes(i)) node.kids.push(walk([...path, i], node.id).id);
    node.row = (byId.get(node.kids[0])!.row + byId.get(node.kids[node.kids.length - 1])!.row) / 2;
    return node;
  };
  walk([], null);
  return { nodes, byId, leaves: row, n, k };
}

/** Узлы, видимые при данном наборе раскрытых: корень и дети раскрытых видимых. */
export function visibleIds(t: Tree, open: Set<string>): Set<string> {
  const out = new Set<string>(['r']);
  const go = (id: string) => { if (!open.has(id)) return; for (const c of t.byId.get(id)!.kids) { out.add(c); go(c); } };
  go('r');
  return out;
}
/** Можно ли раскрыть узел (не лист). */
export const canOpen = (t: Tree, id: string): boolean => (t.byId.get(id)?.depth ?? t.k) < t.k;
/** Дерево раскрыто полностью: раскрыт каждый внутренний узел. */
export const treeComplete = (t: Tree, open: Set<string>): boolean => t.nodes.every(x => x.depth === t.k || open.has(x.id));
/** Раскрыть узел вместе со всем поддеревом (кнопка «Барлығын аш»). */
export function openAll(t: Tree, open: Set<string>): Set<string> {
  const out = new Set(open);
  for (const x of t.nodes) if (x.depth < t.k) out.add(x.id);
  return out;
}
/** Видимые листья. */
export const visibleLeaves = (t: Tree, vis: Set<string>): number => t.nodes.filter(x => x.depth === t.k && vis.has(x.id)).length;

/** Близнец листа при k = 2: путь наоборот («А—Б» ↔ «Б—А»). */
export function twinId(t: Tree, id: string): string | null {
  const x = t.byId.get(id);
  if (!x || t.k !== 2 || x.depth !== 2) return null;
  return idOf([x.path[1], x.path[0]]);
}
/** Касание листа во второй фазе «пар»: оставить этот, вычеркнуть близнеца. 'struck' — лист уже вычеркнут (надо касаться оставленного). */
export function tapLeaf(t: Tree, kept: Set<string>, struck: Set<string>, id: string): 'keep' | 'already' | 'struck' | 'none' {
  const tw = twinId(t, id);
  if (!tw) return 'none';
  if (struck.has(id)) return 'struck';
  if (kept.has(id)) return 'already';
  kept.add(id); struck.add(tw);
  return 'keep';
}
/** Метка листа из букв элементов. */
export const leafLabel = (t: Tree, id: string, items: string[]): string => t.byId.get(id)!.path.map(i => items[i]).join('');
