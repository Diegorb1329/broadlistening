import { z } from "zod";

/** A single input comment, normalized from CSV or API. */
export const inputCommentSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(10_000),
  author: z.string().max(500).default("Anonymous"),
  sourceUrl: z.string().max(2000).optional(),
  timestamp: z.string().max(100).optional(),
});

export type InputComment = z.infer<typeof inputCommentSchema>;

export const runParamsSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).default(""),
  /** Output language for topic/claim text; "auto" = dominant language of comments */
  outputLanguage: z.string().max(20).default("auto"),
  /**
   * Optional analyst lens: free-text instructions appended to the extraction and
   * taxonomy prompts so the same comments can be analyzed under different optics
   * (e.g. "focus on economic arguments", "map claims to policy asks").
   */
  customInstructions: z.string().max(2000).default(""),
});

export type RunParams = z.infer<typeof runParamsSchema>;
