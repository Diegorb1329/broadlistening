import { z } from "zod";

/**
 * T3C v0.2 report schema.
 *
 * Grounded in two real artifacts (committed as fixtures):
 *  - t3c-tiny-example.json      — hand-made tiny report (named topicColors, nested similarClaims)
 *  - funding_values_report.json — production report from broadlistening.org
 *
 * Validation must accept every report the existing viewer accepts, so optional
 * fields stay optional and unknown extra keys are tolerated (zod strips them on
 * parse; consumers that must preserve unknown fields keep the raw JSON and use
 * this schema for validation only).
 */

/** Char-span into the source text: ["text", {startIdx, endIdx}] */
export const spanDataSchema = z.tuple([
  z.literal("text"),
  z.object({ startIdx: z.number(), endIdx: z.number() }),
]);

export const quoteReferenceSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  interview: z.string().optional(),
  data: spanDataSchema.optional(),
  /** Present in some reports (e.g. tiny example): origin label/URL of the source */
  source: z.string().optional(),
  timestamp: z.string().optional(),
});

export const quoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  reference: quoteReferenceSchema,
});

export interface T3CClaim {
  id: string;
  title: string;
  quotes: z.infer<typeof quoteSchema>[];
  number: number;
  similarClaims: T3CClaim[];
}

export const claimSchema: z.ZodType<T3CClaim> = z.object({
  id: z.string(),
  title: z.string(),
  quotes: z.array(quoteSchema),
  number: z.number(),
  get similarClaims() {
    return z.array(claimSchema).default([]);
  },
}) as unknown as z.ZodType<T3CClaim>;

export const subtopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  claims: z.array(claimSchema),
});

export const topicSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  subtopics: z.array(subtopicSchema),
  /** Named color from the viewer palette, e.g. "brown", "blueSky" */
  topicColor: z.string().optional(),
});

/** Source full text: ["text", {text}] */
export const sourceDataSchema = z.tuple([
  z.literal("text"),
  z.object({ text: z.string() }),
]);

export const sourceSchema = z.object({
  id: z.string(),
  interview: z.string().optional(),
  data: sourceDataSchema,
  url: z.string().optional(),
  datetime: z.string().optional(),
});

export const reportDataSchema = z.object({
  title: z.string(),
  description: z.string().default(""),
  date: z.string().optional(),
  addOns: z.record(z.string(), z.unknown()).optional(),
  topics: z.array(topicSchema),
  sources: z.array(sourceSchema),
});

export const reportMetadataSchema = z.object({
  author: z.string().optional(),
  duration: z.number().optional(),
  organization: z.string().optional(),
  startTimestamp: z.number().optional(),
  totalCost: z.union([z.string(), z.number()]).optional(),
});

export const t3cReportSchema = z.object({
  data: z.tuple([z.literal("v0.2"), reportDataSchema]),
  metadata: z.tuple([z.literal("v0.2"), reportMetadataSchema]).optional(),
});

export type T3CQuote = z.infer<typeof quoteSchema>;
export type T3CSubtopic = z.infer<typeof subtopicSchema>;
export type T3CTopic = z.infer<typeof topicSchema>;
export type T3CSource = z.infer<typeof sourceSchema>;
export type T3CReportData = z.infer<typeof reportDataSchema>;
export type T3CReport = z.infer<typeof t3cReportSchema>;

/** Parse and validate a T3C report; throws ZodError with a readable path on failure. */
export function parseT3CReport(json: unknown): T3CReport {
  return t3cReportSchema.parse(json);
}

/** Non-throwing variant. */
export function safeParseT3CReport(json: unknown) {
  return t3cReportSchema.safeParse(json);
}
