# Broad Listening

Turn hundreds of unstructured comments into a structured, explorable topic map — and publish it to the AT Protocol network.

Comments in → LLM claim extraction → emergent topic map → duplicate consolidation → **T3C v0.2 report JSON** → interactive viewer → published to your own PDS.

## How it works

```
CSV upload → extract claims (quality-gated, per-comment isolation)
           → build taxonomy from claim titles (one long-context call)
           → assign claims to subtopics (batched, unplaced → "Other")
           → consolidate duplicates (ephemeral embeddings propose, LLM verifies, fail-open)
           → assemble + validate T3C v0.2 report
```

- **Web (hosted)**: upload up to 200 comments per run; durable pipeline on Vercel Workflow; live progress; view, download, or publish the result.
- **CLI (local, uncapped)**: `pnpm cli analyze data.csv` with your own OpenRouter key; resumable via a local state file.
- **No database**: published analyses live in *your* ATProto repo (`org.gainforest.broadlistening.analysis` record + report blob). Unpublished runs are ephemeral.
- **Viewer**: `/dashboard?report=<url>` renders any T3C v0.2 JSON — including reports produced by other tools.

## Monorepo

```
apps/web        Next.js app — studio, durable analyze workflow, T3C viewer, ATProto OAuth + publish
apps/cli        broadlistening CLI (analyze, resumable state, JSON progress events)
packages/schema zod schemas: T3C v0.2 (validated against real reports), lexicon record, inputs
packages/llm    provider layer (OpenRouter BYO-key / AI Gateway), prompts, error taxonomy, retry
packages/pipeline  the 5-stage pipeline, CSV parsing, similarity blocking, report assembly
```

## Development

```bash
pnpm install
cp .env.example .env            # add your OPENROUTER_API_KEY
pnpm dev                        # web app on :3000
pnpm test                       # unit tests (schema fixtures + pipeline math)

# CLI
pnpm cli analyze path/to/comments.csv --title "My Analysis"
```

ATProto login works out of the box in dev (public loopback client). For production, set
`PUBLIC_URL`, `COOKIE_SECRET`, and `ATPROTO_JWK_PRIVATE` (confidential client).

## Retry & failure model

One classification function decides everything (`packages/llm/src/errors.ts`): 429s back off honoring `Retry-After`; invalid keys stop the run immediately; malformed outputs get exactly one repair attempt; comments failing 3 times are excluded from automatic retries. Failures are always reported, never looped.

## License

AGPL-3.0 — the viewer components and design system are derived from
[GainForest/broadlistening-frontend](https://github.com/GainForest/broadlistening-frontend).
