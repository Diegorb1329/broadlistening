import { z } from "zod";

/**
 * NOTE: these schemas are sent to providers as JSON Schema for constrained
 * decoding. Gemini rejects numeric bounds on (nested) arrays — "schema produces
 * a constraint that has too many states for serving" — so cardinality limits
 * live in the prompts and are enforced in code after parsing, never here.
 */

/** Stage 1 — per-comment claim extraction */
export const extractionOutputSchema = z.object({
  lang: z.string().describe("ISO 639-1 language code of the comment"),
  claims: z.array(
    z.object({
      title: z
        .string()
        .describe("Specific, self-contained claim in the requested output language"),
      quote: z
        .string()
        .describe("Verbatim excerpt from the comment supporting this claim"),
    }),
  ),
});
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

/** Stage 2 — taxonomy from claim titles */
export const taxonomyOutputSchema = z.object({
  topics: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      subtopics: z.array(z.object({ title: z.string(), description: z.string() })),
    }),
  ),
});
export type TaxonomyOutput = z.infer<typeof taxonomyOutputSchema>;

/** Stage 3b (strict mode) — extend the taxonomy to cover unplaced claims */
export const taxonomyExtensionOutputSchema = z.object({
  additions: z.array(
    z.object({
      /** existing topic number ("3") or "new" */
      topic: z.string(),
      /** title/description of the new topic (ignored when extending an existing one) */
      title: z.string(),
      description: z.string(),
      subtopics: z.array(z.object({ title: z.string(), description: z.string() })),
    }),
  ),
});
export type TaxonomyExtensionOutput = z.infer<typeof taxonomyExtensionOutputSchema>;

/** Stage 3 — assign claims to subtopics */
export const assignmentOutputSchema = z.object({
  assignments: z.array(
    z.object({
      claimId: z.string(),
      /** "T.S" index like "2.1", or "other" when nothing fits */
      subtopic: z.string(),
    }),
  ),
});
export type AssignmentOutput = z.infer<typeof assignmentOutputSchema>;

/** Stage 4 — verify candidate duplicate groups */
export const dedupOutputSchema = z.object({
  groups: z.array(
    z.object({
      groupId: z.string(),
      /** Partition of the candidate group into true duplicate sets (singletons allowed) */
      subgroups: z.array(
        z.object({
          claimIds: z.array(z.string()),
          /** Consolidated claim title for the subgroup, in the output language */
          title: z.string(),
        }),
      ),
    }),
  ),
});
export type DedupOutput = z.infer<typeof dedupOutputSchema>;

/** Language detection (prepare stage, outputLanguage="auto") */
export const languageOutputSchema = z.object({
  dominantLanguage: z.string().describe("ISO 639-1 code of the dominant language"),
});
export type LanguageOutput = z.infer<typeof languageOutputSchema>;
