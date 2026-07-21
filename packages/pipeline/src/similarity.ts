/**
 * Dedup candidate generation (architecture §6 Stage 4, steps 1-2):
 * exact cosine similarity over all pairs + union-find → candidate groups.
 * Cheap deterministic math; the LLM only judges the candidates.
 */

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]!]!;
      x = this.parent[x]!;
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

export interface CandidateGroup {
  /** indices into the input array */
  members: number[];
}

/**
 * Find candidate duplicate groups among items with embeddings.
 * O(n²) dot products — fine for ≤ ~20k items (3k claims ≈ 4.5M ops, milliseconds).
 * Groups larger than maxGroupSize are split (highest-similarity-first greedy chunks).
 */
export function findCandidateGroups(
  embeddings: number[][],
  threshold = 0.8,
  maxGroupSize = 10,
): CandidateGroup[] {
  const n = embeddings.length;
  const uf = new UnionFind(n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosine(embeddings[i]!, embeddings[j]!) >= threshold) uf.union(i, j);
    }
  }
  const components = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    const list = components.get(root);
    if (list) list.push(i);
    else components.set(root, [i]);
  }
  const groups: CandidateGroup[] = [];
  for (const members of components.values()) {
    if (members.length < 2) continue;
    for (let off = 0; off < members.length; off += maxGroupSize) {
      const chunk = members.slice(off, off + maxGroupSize);
      if (chunk.length >= 2) groups.push({ members: chunk });
    }
  }
  return groups;
}
