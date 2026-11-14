/**
 * Records one real Gemini response for the sample documents into
 * lib/sample-seed.json, which pre-warms the cache in lib/gemini.ts.
 *
 * Why: the free tier has a daily cap. Without this, a judge clicking
 * "Try a sample" after the cap is hit sees an error instead of the product.
 * The recorded response is a genuine model output for those exact PDFs — the
 * rule engine, the money maths and the report still run live on top of it,
 * and any other document hashes differently and calls Gemini live.
 *
 * Re-run whenever the prompt or the model changes, or the seed stops matching
 * and is ignored:
 *   npm run record-sample
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  analyzeDocuments,
  cacheKey,
  clearCacheForTests,
  getModelId,
  type DocumentInput,
} from "@/lib/gemini";
import { runRules } from "@/lib/rules";

const PROMPT_VERSION = "v1";
const SEED_PATH = path.join(process.cwd(), "lib", "sample-seed.json");

function loadEnv() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const name = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (value) process.env[name] = value;
  }
}

function sampleFile(name: string): DocumentInput {
  return {
    kind: "file",
    mimeType: "application/pdf",
    bytes: new Uint8Array(
      readFileSync(path.join(process.cwd(), "public", "samples", name)),
    ),
  };
}

async function main() {
  loadEnv();

  // Make sure this is a live call, not a replay of the existing seed.
  clearCacheForTests();

  const model = getModelId();
  const quoteName = "quote-bathroom.pdf";
  const coName = "change-order-1.pdf";
  const quote = sampleFile(quoteName);
  const changeOrder = sampleFile(coName);

  console.log(`recording ${quoteName} + ${coName} with ${model}…`);
  const started = Date.now();
  const outcome = await analyzeDocuments(quote, changeOrder);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (!outcome.ok) {
    console.error(`failed after ${seconds}s: ${outcome.error}`);
    console.error("The model is busy or out of quota. Try again later.");
    process.exit(1);
  }
  if (outcome.prepared) {
    console.error("refusing to record a replay of the existing seed");
    process.exit(1);
  }
  if (!outcome.data.quote) {
    console.error("the model returned no quote extraction");
    process.exit(1);
  }

  // Prove the recording is usable before writing it.
  const { flags, atStakeCents } = runRules({
    quote: outcome.data.quote,
    changeOrder: outcome.data.change_order,
    matches: outcome.data.matches,
    judgmentFlags: outcome.data.judgment_flags,
  });

  const seed = {
    recordedAt: new Date().toISOString(),
    model,
    promptVersion: PROMPT_VERSION,
    key: cacheKey(model, quote, changeOrder),
    documents: [quoteName, coName],
    note:
      "A real Gemini response for the two sample PDFs, recorded so the demo " +
      "survives the free-tier daily cap. Flags, totals and the report are " +
      "still computed live from this by lib/rules.ts. User uploads hash " +
      "differently and always call Gemini.",
    response: outcome.data,
  };

  writeFileSync(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf8");

  console.log(
    `recorded in ${seconds}s -> ${path.relative(process.cwd(), SEED_PATH)}`,
  );
  console.log(`  key:        ${seed.key}`);
  console.log(`  at stake:   $${(atStakeCents / 100).toFixed(2)}`);
  console.log(`  flags:      ${flags.map((flag) => flag.type).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
