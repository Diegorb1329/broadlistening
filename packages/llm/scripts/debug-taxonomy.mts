import { createLLMClient, buildTaxonomy } from "../src/index.js";
import { APICallError, RetryError } from "ai";
const client = createLLMClient({ apiKey: process.env.OPENROUTER_API_KEY });
const titles = [
  "OpenAI should release alignment datasets", "AI alignment needs more funding",
  "Superintelligence coordination is required", "GPT-4 alignment improved over prior models",
  "A global regulatory framework is needed", "Democratic governance should steer AGI",
];
try {
  const r = await buildTaxonomy(client, titles, "en");
  console.log(JSON.stringify(r.data, null, 1));
} catch (err) {
  let e: unknown = err;
  // unwrap PipelineError → cause chains to find APICallError
  for (let i = 0; i < 6 && e; i++) {
    if (APICallError.isInstance(e)) { console.log("STATUS:", e.statusCode, "\nBODY:", e.responseBody?.slice(0, 800)); break; }
    if (RetryError.isInstance(e)) { e = e.lastError; continue; }
    e = (e as { classified?: { cause: unknown } }).classified?.cause ?? (e as Error).cause;
  }
  if (!APICallError.isInstance(e)) console.log("raw:", (err as Error).stack?.slice(0, 600));
}
