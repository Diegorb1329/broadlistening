import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectTextColumn, parseCommentsCsv } from "../src/csv.js";

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../schema/fixtures",
);

describe("parseCommentsCsv", () => {
  it("parses tw_76.csv (100 tweets, id+comment columns)", () => {
    const csv = readFileSync(join(fixtures, "tw_76.csv"), "utf8");
    expect(detectTextColumn(["id", "comment"])).toBe("comment");
    const result = parseCommentsCsv(csv, { textColumn: "comment", idColumn: "id" });
    expect(result.columns).toEqual(["id", "comment"]);
    expect(result.comments.length + result.dropped.length).toBe(100);
    expect(result.comments.length).toBeGreaterThan(90);
    expect(result.comments[0]!.id).toBe("1641820534748094465");
    expect(result.comments[0]!.text).toContain("alignment");
  });

  it("drops empty rows and duplicates with reasons", () => {
    const csv = 'id,comment\n1,"hello world"\n2,""\n3,"hello   world"\n4,"unique"';
    const r = parseCommentsCsv(csv, { textColumn: "comment", idColumn: "id" });
    expect(r.comments.map((c) => c.id)).toEqual(["1", "4"]);
    expect(r.dropped).toEqual([
      { row: 3, reason: "empty text" },
      { row: 4, reason: "duplicate text" },
    ]);
  });

  it("defaults author and generates row ids", () => {
    const csv = "comment\nsomething substantive";
    const r = parseCommentsCsv(csv, { textColumn: "comment" });
    expect(r.comments[0]).toMatchObject({ id: "row-2", author: "Anonymous" });
  });
});
