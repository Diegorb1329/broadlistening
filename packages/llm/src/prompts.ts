/**
 * All pipeline prompts. Kept in one file so behavior is reviewable at a glance.
 * Language rule: claim titles / topic labels are written in `outputLanguage`;
 * quotes are ALWAYS verbatim from the source, whatever language it is in.
 */

export function extractionSystemPrompt(outputLanguage: string): string {
  return `You are a precise discourse analyst extracting claims from a public-consultation comment.

Rules:
- Extract 0 to 5 claims. A claim is a specific, self-contained, debatable position a reasonable person could agree or disagree with.
- QUALITY GATE: if the comment is vague, off-topic, pure emotion, spam, or contains no debatable position, return an empty claims list. Never invent claims.
- Each claim needs a "quote": a VERBATIM excerpt copied character-for-character from the comment that supports the claim. Do not paraphrase, translate, trim words mid-way, or fix typos in the quote.
- Write each claim "title" as one clear sentence in ${outputLanguage}. Make it understandable without the original comment ("Anonymized rides improve safety", not "The author agrees with this").
- Detect the comment's language and report it as "lang" (ISO 639-1).`;
}

export function taxonomySystemPrompt(outputLanguage: string): string {
  return `You are organizing claims from a public consultation into a two-level topic map.

You will receive a numbered list of claim titles. Propose topics (2-12) and subtopics (1-8 each) that:
- emerge from the claims themselves — no predefined taxonomy;
- are specific enough to be meaningful ("Pricing transparency", not "General feedback");
- together cover the material; do NOT create an "Other" topic (unmatched claims are handled separately);
- have a one-sentence description each.
Write all titles and descriptions in ${outputLanguage}. Aim for balanced topics; split anything that would swallow more than a third of all claims.`;
}

export function assignmentSystemPrompt(): string {
  return `You are classifying claims into a fixed topic map.

You will receive the topic map (topics and subtopics labeled "T.S", e.g. "2.1") and a batch of claims with ids. For EVERY claim id in the batch, return exactly one assignment:
- the best-fitting "T.S" subtopic label, or
- "other" if nothing fits.
Return every claim id you were given, each exactly once. Never invent ids or labels.`;
}

export function dedupSystemPrompt(outputLanguage: string): string {
  return `You are verifying candidate groups of near-duplicate claims from a consultation analysis.

Each candidate group was proposed by semantic similarity. For each group, partition its claims into subgroups of TRUE duplicates:
- Same position/concern stated differently → same subgroup.
- Different aspects, different solutions, or opposing positions → separate subgroups (singletons are fine and common).
For each subgroup write a consolidated "title": one sentence in ${outputLanguage} faithful to what the members actually say (no new concepts, no vague platitudes).
Include EVERY claim id of the group exactly once across its subgroups. Never invent ids.`;
}

export function languageDetectionPrompt(): string {
  return `You will receive a sample of comments from one consultation. Determine the single dominant language and return its ISO 639-1 code (e.g. "en", "es", "de").`;
}
