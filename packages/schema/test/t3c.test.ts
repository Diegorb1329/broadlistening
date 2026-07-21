import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { parseT3CReport, safeParseT3CReport } from "../src/t3c.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const load = (name: string) =>
  JSON.parse(readFileSync(join(fixtures, name), "utf8"));

describe("t3cReportSchema", () => {
  it("accepts the tiny reference report (named colors, nested similarClaims)", () => {
    const report = parseT3CReport(load("t3c-tiny-example.json"));
    const [, data] = report.data;
    expect(data.title).toBe("tiny_metadata_test");
    expect(data.topics).toHaveLength(2);
    expect(data.topics[0]!.topicColor).toBe("brown");
    // nested similarClaims survive as full claims
    const claimWithSimilar = data.topics[1]!.subtopics[0]!.claims[0]!;
    expect(claimWithSimilar.similarClaims).toHaveLength(1);
    expect(claimWithSimilar.similarClaims[0]!.quotes[0]!.text).toContain(
      "much better conversations",
    );
    expect(data.sources).toHaveLength(6);
  });

  it("accepts the production funding_values report (627 sources)", () => {
    const report = parseT3CReport(load("funding_values_report.json"));
    const [, data] = report.data;
    expect(data.topics).toHaveLength(12);
    expect(data.sources).toHaveLength(627);
    // every quote reference must point at an existing source
    const sourceIds = new Set(data.sources.map((s) => s.id));
    for (const topic of data.topics)
      for (const st of topic.subtopics)
        for (const claim of st.claims)
          for (const q of claim.quotes)
            expect(sourceIds.has(q.reference.sourceId)).toBe(true);
  });

  it("rejects structurally invalid reports", () => {
    expect(safeParseT3CReport({}).success).toBe(false);
    expect(safeParseT3CReport({ data: ["v0.1", {}] }).success).toBe(false);
    expect(
      safeParseT3CReport({ data: ["v0.2", { title: "x", topics: "nope", sources: [] }] })
        .success,
    ).toBe(false);
  });
});
