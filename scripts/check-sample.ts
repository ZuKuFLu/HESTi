/**
 * Runs the sample documents through the real pipeline several times to see how
 * stable the model's judgments are. Checkpoint B helper, not part of the app.
 *
 * Run: npx tsx scripts/check-sample.ts [runs] [modelId]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { analyzeDocuments, clearCacheForTests } from "@/lib/gemini";
import { runRules } from "@/lib/rules";

function loadEnv() {
  for (const line of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (value) process.env[name] = value;
  }
}

function sample(name: string) {
  return {
    kind: "file" as const,
    mimeType: "application/pdf",
    bytes: new Uint8Array(readFileSync(path.join(process.cwd(), "public", "samples", name))),
  };
}

async function main() {
  loadEnv();
  const runs = Number(process.argv[2] ?? 3);
  const modelOverride = process.argv[3];
  if (modelOverride) process.env.GEMINI_MODEL = modelOverride;

  console.log(`model: ${process.env.GEMINI_MODEL}, runs: ${runs}\n`);

  const quote = sample("quote-bathroom.pdf");
  const changeOrder = sample("change-order-1.pdf");

  for (let i = 1; i <= runs; i += 1) {
    clearCacheForTests();
    const started = Date.now();
    const outcome = await analyzeDocuments(quote, changeOrder);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    if (!outcome.ok) {
      console.log(`run ${i}: FAILED (${outcome.error}) in ${seconds}s`);
      continue;
    }

    const quoteExtraction = outcome.data.quote;
    if (!quoteExtraction) {
      console.log(`run ${i}: model returned no quote`);
      continue;
    }

    const { flags, atStakeCents } = runRules({
      quote: quoteExtraction,
      changeOrder: outcome.data.change_order,
      matches: outcome.data.matches,
      judgmentFlags: outcome.data.judgment_flags,
    });

    const types = flags.map((flag) => flag.type).sort().join(", ");
    const relations = outcome.data.matches
      .map((match) => `${match.co_line_id}:${match.relation}`)
      .join(" ");

    console.log(
      `run ${i} (${seconds}s): $${(atStakeCents / 100).toFixed(2)} at stake\n  flags: ${types}\n  matches: ${relations}\n`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
