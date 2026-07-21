import { describe, expect, it } from "vitest";
import { cosine, findCandidateGroups, UnionFind } from "../src/similarity.js";

describe("cosine", () => {
  it("computes similarity", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 1], [1, 1])).toBeCloseTo(1);
    expect(cosine([0, 0], [1, 1])).toBe(0);
  });
});

describe("UnionFind", () => {
  it("merges components transitively", () => {
    const uf = new UnionFind(5);
    uf.union(0, 1);
    uf.union(1, 2);
    expect(uf.find(0)).toBe(uf.find(2));
    expect(uf.find(3)).not.toBe(uf.find(0));
  });
});

describe("findCandidateGroups", () => {
  const v = (angleDeg: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return [Math.cos(a), Math.sin(a)];
  };

  it("groups similar vectors and leaves singletons out", () => {
    // 0° and 5° are similar (cos≈0.996); 90° is not
    const groups = findCandidateGroups([v(0), v(5), v(90)], 0.9);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.members.sort()).toEqual([0, 1]);
  });

  it("splits oversized components", () => {
    const embeddings = Array.from({ length: 25 }, () => v(0));
    const groups = findCandidateGroups(embeddings, 0.9, 10);
    expect(groups.map((g) => g.members.length)).toEqual([10, 10, 5]);
    const all = groups.flatMap((g) => g.members).sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });

  it("returns nothing below threshold", () => {
    expect(findCandidateGroups([v(0), v(45)], 0.9)).toHaveLength(0);
  });
});
