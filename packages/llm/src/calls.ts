import { embedMany, generateText, Output } from "ai";
import type { z } from "zod";
import type { LLMClient } from "./provider.js";
import { withRetry } from "./retry.js";
import { classifyError, PipelineError } from "./errors.js";
import {
  assignmentOutputSchema,
  dedupOutputSchema,
  extractionOutputSchema,
  languageOutputSchema,
  taxonomyOutputSchema,
  type AssignmentOutput,
  type DedupOutput,
  type ExtractionOutput,
  type TaxonomyOutput,
} from "./outputs.js";
import {
  assignmentSystemPrompt,
  dedupSystemPrompt,
  extractionSystemPrompt,
  languageDetectionPrompt,
  taxonomySystemPrompt,
} from "./prompts.js";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface CallResult<T> {
  data: T;
  usage: Usage;
}

/**
 * Structured-output call with the system's retry taxonomy:
 * RETRYABLE handled by withRetry; MALFORMED gets ONE repair attempt with
 * error feedback appended, then fails classified.
 */
async function structuredCall<S extends z.ZodType>(
  client: LLMClient,
  schema: S,
  system: string,
  prompt: string,
): Promise<CallResult<z.infer<S>>> {
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };

  const attempt = (extra: string) =>
    withRetry(async () => {
      const result = await generateText({
        model: client.chat,
        system,
        prompt: extra ? `${prompt}\n\n${extra}` : prompt,
        output: Output.object({ schema }),
        maxRetries: 0, // the SDK must not retry — withRetry owns the policy
      });
      usage.inputTokens += result.usage.inputTokens ?? 0;
      usage.outputTokens += result.usage.outputTokens ?? 0;
      return result.output as z.infer<S>;
    });

  try {
    return { data: await attempt(""), usage };
  } catch (err) {
    const classified = err instanceof PipelineError ? err.classified : classifyError(err);
    if (classified.cls !== "MALFORMED") throw new PipelineError(classified);
    // One repair pass with explicit feedback (architecture §8).
    const feedback = `IMPORTANT: your previous response failed validation (${classified.message.slice(0, 300)}). Follow the schema exactly.`;
    return { data: await attempt(feedback), usage };
  }
}

export async function detectLanguage(
  client: LLMClient,
  sampleTexts: string[],
): Promise<CallResult<string>> {
  const prompt = sampleTexts
    .slice(0, 30)
    .map((t, i) => `${i + 1}. ${t.slice(0, 300)}`)
    .join("\n");
  const r = await structuredCall(client, languageOutputSchema, languageDetectionPrompt(), prompt);
  return { data: r.data.dominantLanguage, usage: r.usage };
}

export async function extractClaims(
  client: LLMClient,
  commentText: string,
  outputLanguage: string,
): Promise<CallResult<ExtractionOutput>> {
  return structuredCall(
    client,
    extractionOutputSchema,
    extractionSystemPrompt(outputLanguage),
    `Comment:\n"""\n${commentText}\n"""`,
  );
}

export async function buildTaxonomy(
  client: LLMClient,
  claimTitles: string[],
  outputLanguage: string,
): Promise<CallResult<TaxonomyOutput>> {
  const prompt = `Claims (${claimTitles.length}):\n${claimTitles
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n")}`;
  return structuredCall(client, taxonomyOutputSchema, taxonomySystemPrompt(outputLanguage), prompt);
}

export interface TaxonomyForAssignment {
  topics: { title: string; subtopics: { title: string }[] }[];
}

export async function assignClaims(
  client: LLMClient,
  taxonomy: TaxonomyForAssignment,
  claims: { id: string; title: string }[],
): Promise<CallResult<AssignmentOutput>> {
  const tree = taxonomy.topics
    .map(
      (t, ti) =>
        `Topic ${ti + 1}: ${t.title}\n` +
        t.subtopics.map((s, si) => `  ${ti + 1}.${si + 1}: ${s.title}`).join("\n"),
    )
    .join("\n");
  const batch = claims.map((c) => `- id=${c.id}: ${c.title}`).join("\n");
  return structuredCall(
    client,
    assignmentOutputSchema,
    assignmentSystemPrompt(),
    `Topic map:\n${tree}\n\nClaims to classify:\n${batch}`,
  );
}

export async function verifyDuplicateGroups(
  client: LLMClient,
  groups: { groupId: string; claims: { id: string; title: string }[] }[],
  outputLanguage: string,
): Promise<CallResult<DedupOutput>> {
  const prompt = groups
    .map(
      (g) =>
        `Group ${g.groupId}:\n` + g.claims.map((c) => `  - id=${c.id}: ${c.title}`).join("\n"),
    )
    .join("\n\n");
  return structuredCall(client, dedupOutputSchema, dedupSystemPrompt(outputLanguage), prompt);
}

/** Batch-embed texts (dedup blocking). Vectors are ephemeral — never persisted. */
export async function embedTexts(
  client: LLMClient,
  texts: string[],
): Promise<CallResult<number[][]>> {
  return withRetry(async () => {
    const { embeddings, usage } = await embedMany({
      model: client.embedding,
      values: texts,
      maxRetries: 0,
    });
    return {
      data: embeddings,
      usage: { inputTokens: usage?.tokens ?? 0, outputTokens: 0 },
    };
  });
}
