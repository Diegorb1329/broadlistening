import { describe, expect, it } from "vitest";
import { safeParseT3CReport } from "@broadlistening/schema";
import { assembleReport } from "../src/report.js";
import { createRunState } from "../src/state.js";

function syntheticState() {
  const comments = [
    { id: "c1", text: "Parking fees are far too expensive downtown", author: "Ana" },
    { id: "c2", text: "The cost of parking is way too high in the center", author: "Ben" },
    { id: "c3", text: "We need more bike lanes on main street", author: "Cruz", sourceUrl: "https://x.com/p/1", timestamp: "2026-01-01" },
    { id: "c4", text: "whatever lol", author: "Dud" },
  ];
  const state = createRunState(comments as never, {
    title: "Test Run",
    description: "d",
    outputLanguage: "en",
    customInstructions: "",
  });
  state.outputLanguage = "en";
  state.extraction["c1"] = {
    status: "done", attempts: 1, lang: "en",
    claims: [{ id: "k1", title: "Parking is too expensive", quote: "Parking fees are far too expensive" }],
  };
  state.extraction["c2"] = {
    status: "done", attempts: 1, lang: "en",
    claims: [{ id: "k2", title: "Parking costs too much", quote: "cost of parking is way too high" }],
  };
  state.extraction["c3"] = {
    status: "done", attempts: 1, lang: "en",
    claims: [{ id: "k3", title: "More bike lanes are needed", quote: "We need more bike lanes" }],
  };
  state.extraction["c4"] = { status: "failed", attempts: 2, errorCode: "malformed_output" };
  state.taxonomy = {
    topics: [
      {
        title: "Transportation", description: "Mobility topics",
        subtopics: [
          { title: "Parking", description: "Parking concerns" },
          { title: "Cycling", description: "Bike infrastructure" },
        ],
      },
    ],
  };
  state.assignments = { k1: "0.0", k2: "0.0", k3: "0.1" };
  state.consolidation = [{ primaryClaimId: "k1", memberClaimIds: ["k2"], title: "Parking is too expensive downtown" }];
  return state;
}

describe("assembleReport", () => {
  it("produces a schema-valid report with consolidation nested as similarClaims", () => {
    const report = assembleReport(syntheticState());
    expect(safeParseT3CReport(report).success).toBe(true);

    const [, data] = report.data;
    expect(data.title).toBe("Test Run");
    expect(data.topics).toHaveLength(1);
    const [parking, cycling] = data.topics[0]!.subtopics;
    // consolidated primary carries the group title and nests the member
    expect(parking!.claims).toHaveLength(1);
    expect(parking!.claims[0]!.title).toBe("Parking is too expensive downtown");
    expect(parking!.claims[0]!.similarClaims).toHaveLength(1);
    expect(parking!.claims[0]!.similarClaims[0]!.id).toBe("k2");
    expect(cycling!.claims[0]!.id).toBe("k3");

    // all 4 comments become sources (including the failed one — full provenance)
    expect(data.sources).toHaveLength(4);
    // quote references resolve to real sources with computed spans
    const q = parking!.claims[0]!.quotes[0]!;
    const src = data.sources.find((s) => s.id === q.reference.sourceId)!;
    const [, span] = q.reference.data!;
    expect(src.data[1].text.slice(span.startIdx, span.endIdx)).toBe(q.text);
    // sourceUrl/timestamp surface on the reference
    const bike = cycling!.claims[0]!.quotes[0]!;
    expect(bike.reference.source).toBe("https://x.com/p/1");
    expect(bike.reference.timestamp).toBe("2026-01-01");
    // claim numbering is global and sequential
    const numbers = [
      parking!.claims[0]!.number,
      parking!.claims[0]!.similarClaims[0]!.number,
      cycling!.claims[0]!.number,
    ];
    expect(new Set(numbers).size).toBe(3);
  });

  it("routes unassigned claims to an Other topic and prunes empty branches", () => {
    const state = syntheticState();
    state.assignments = { k1: "0.0", k2: "0.0", k3: "other" };
    const report = assembleReport(state);
    const [, data] = report.data;
    expect(data.topics.map((t) => t.title)).toEqual(["Transportation", "Other"]);
    // Cycling subtopic was empty → pruned
    expect(data.topics[0]!.subtopics.map((s) => s.title)).toEqual(["Parking"]);
    expect(data.topics[1]!.subtopics[0]!.claims[0]!.id).toBe("k3");
  });
});
