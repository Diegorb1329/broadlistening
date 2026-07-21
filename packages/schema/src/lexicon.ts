import { z } from "zod";

/**
 * ATProto record shape for a published analysis.
 * NSID authority: gainforest.org. Records ship now; formal lexicon schema
 * records are published once the shape stabilizes ($type + formatVersion
 * keep early records forward-compatible).
 */
export const ANALYSIS_COLLECTION = "org.gainforest.broadlistening.analysis";

export const blobRefSchema = z.object({
  $type: z.literal("blob"),
  ref: z.object({ $link: z.string() }),
  mimeType: z.string(),
  size: z.number(),
});

export const analysisRecordSchema = z.object({
  $type: z.literal(ANALYSIS_COLLECTION),
  formatVersion: z.literal("t3c-v0.2"),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).default(""),
  createdAt: z.string(),
  language: z.string().max(20).default("en"),
  counts: z.object({
    comments: z.number(),
    claims: z.number(),
    topics: z.number(),
  }),
  tool: z.enum(["web", "cli"]),
  /** gzipped T3C v0.2 JSON */
  report: blobRefSchema,
  /** Large reports only: source-shard blobs (see architecture §5a) */
  reportParts: z.array(blobRefSchema).optional(),
});

export type AnalysisRecord = z.infer<typeof analysisRecordSchema>;
