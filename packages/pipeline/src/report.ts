import { parseT3CReport, type T3CClaim, type T3CReport, type T3CSource } from "@broadlistening/schema";
import type { RunState, ExtractedClaim } from "./state.js";

/**
 * Stage 5 — assemble the T3C v0.2 report from run state.
 * Output is zod-validated before it is returned; reports never exist invalid.
 */

/** Named colors for T3C compatibility (the reference viewer colors by index, not name). */
const TOPIC_COLOR_NAMES = [
  "blueSea", "blueSky", "green", "purple", "brown",
  "red", "orange", "teal", "yellow", "pink", "indigo", "gray",
];

interface ClaimCtx {
  claim: ExtractedClaim;
  commentId: string;
}

function computeSpan(sourceText: string, quote: string): { startIdx: number; endIdx: number } {
  const idx = sourceText.indexOf(quote);
  if (idx !== -1) return { startIdx: idx, endIdx: idx + quote.length };
  const lowerIdx = sourceText.toLowerCase().indexOf(quote.toLowerCase());
  if (lowerIdx !== -1) return { startIdx: lowerIdx, endIdx: lowerIdx + quote.length };
  return { startIdx: 0, endIdx: sourceText.length };
}

export function assembleReport(state: RunState): T3CReport {
  const { comments, extraction, taxonomy, assignments, consolidation, params } = state;
  if (!taxonomy || !assignments) throw new Error("assembleReport: missing taxonomy/assignments");

  // Index claims and their comments
  const claimCtx = new Map<string, ClaimCtx>();
  for (const comment of comments) {
    const ext = extraction[comment.id];
    if (ext?.status !== "done" || !ext.claims) continue;
    for (const claim of ext.claims) claimCtx.set(claim.id, { claim, commentId: comment.id });
  }
  const commentById = new Map(comments.map((c) => [c.id, c]));
  const sourceIdByComment = new Map<string, string>(comments.map((c) => [c.id, crypto.randomUUID()]));

  // Consolidation lookups
  const groupByPrimary = new Map((consolidation ?? []).map((g) => [g.primaryClaimId, g]));
  const memberOf = new Map<string, string>();
  for (const g of consolidation ?? [])
    for (const m of g.memberClaimIds) memberOf.set(m, g.primaryClaimId);

  let counter = 0;
  const buildClaim = (claimId: string, titleOverride?: string): T3CClaim | undefined => {
    const ctx = claimCtx.get(claimId);
    if (!ctx) return undefined;
    const comment = commentById.get(ctx.commentId);
    if (!comment) return undefined;
    counter++;
    return {
      id: claimId,
      title: titleOverride ?? ctx.claim.title,
      number: counter,
      quotes: [
        {
          id: crypto.randomUUID(),
          text: ctx.claim.quote,
          reference: {
            id: crypto.randomUUID(),
            sourceId: sourceIdByComment.get(ctx.commentId)!,
            interview: comment.author,
            data: ["text", computeSpan(comment.text, ctx.claim.quote)] as const,
            ...(comment.sourceUrl ? { source: comment.sourceUrl } : {}),
            ...(comment.timestamp ? { timestamp: comment.timestamp } : {}),
          },
        },
      ],
      similarClaims: [],
    };
  };

  // Bucket claims by "t.s" label
  const buckets = new Map<string, string[]>();
  for (const [claimId, label] of Object.entries(assignments)) {
    if (memberOf.has(claimId)) continue; // members render nested under their primary
    const list = buckets.get(label);
    if (list) list.push(claimId);
    else buckets.set(label, [claimId]);
  }

  const topics = taxonomy.topics.map((topic, ti) => ({
    id: crypto.randomUUID(),
    title: topic.title,
    description: topic.description,
    topicColor: TOPIC_COLOR_NAMES[ti % TOPIC_COLOR_NAMES.length]!,
    subtopics: topic.subtopics.map((sub, si) => {
      const claimIds = buckets.get(`${ti}.${si}`) ?? [];
      // primaries with most duplicates first (mirrors reference sorting)
      claimIds.sort(
        (a, b) =>
          (groupByPrimary.get(b)?.memberClaimIds.length ?? 0) -
          (groupByPrimary.get(a)?.memberClaimIds.length ?? 0),
      );
      const claims: T3CClaim[] = [];
      for (const claimId of claimIds) {
        const group = groupByPrimary.get(claimId);
        const built = buildClaim(claimId, group?.title);
        if (!built) continue;
        if (group) {
          built.similarClaims = group.memberClaimIds
            .map((m) => buildClaim(m))
            .filter((c): c is T3CClaim => c !== undefined);
        }
        claims.push(built);
      }
      return { id: crypto.randomUUID(), title: sub.title, description: sub.description, claims };
    }),
  }));

  // "other" bucket → its own topic, only when non-empty
  const otherIds = buckets.get("other") ?? [];
  const otherClaims = otherIds
    .map((id) => buildClaim(id, groupByPrimary.get(id)?.title))
    .filter((c): c is T3CClaim => c !== undefined);
  if (otherClaims.length > 0) {
    topics.push({
      id: crypto.randomUUID(),
      title: "Other",
      description: "Claims that did not fit the topic map.",
      topicColor: TOPIC_COLOR_NAMES[topics.length % TOPIC_COLOR_NAMES.length]!,
      subtopics: [
        { id: crypto.randomUUID(), title: "Unclassified", description: "", claims: otherClaims },
      ],
    });
  }

  // Drop empty subtopics/topics (taxonomy branches nothing landed in)
  const prunedTopics = topics
    .map((t) => ({ ...t, subtopics: t.subtopics.filter((s) => s.claims.length > 0) }))
    .filter((t) => t.subtopics.length > 0);

  const sources: T3CSource[] = comments.map((c) => ({
    id: sourceIdByComment.get(c.id)!,
    interview: c.author,
    data: ["text", { text: c.text }] as const,
  }));

  const report = {
    data: [
      "v0.2",
      {
        title: params.title,
        description: params.description,
        date: new Date().toISOString(),
        addOns: {},
        topics: prunedTopics,
        sources,
      },
    ],
    metadata: [
      "v0.2",
      {
        author: "",
        duration: 0,
        organization: "",
        startTimestamp: Date.parse(state.startedAt),
        totalCost: "",
      },
    ],
  };

  return parseT3CReport(report);
}
