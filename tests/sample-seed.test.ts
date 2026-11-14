import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cacheKey, type DocumentInput } from "@/lib/gemini";
import { runRules } from "@/lib/rules";
import { aiResponseSchema } from "@/lib/schemas";
import seed from "@/lib/sample-seed.json";

/**
 * The sample's Gemini response is recorded so a judging demo survives the
 * free-tier daily cap. These tests hold that arrangement honest:
 *
 *  - the recording is a real, schema-valid model response;
 *  - the findings are still computed from it by the rule engine;
 *  - it is bound by hash to the two sample PDFs, so no user upload can be
 *    answered from it.
 */

function sampleFile(name: string): DocumentInput {
  return {
    kind: "file",
    mimeType: "application/pdf",
    bytes: new Uint8Array(
      readFileSync(path.join(process.cwd(), "public", "samples", name)),
    ),
  };
}

const QUOTE = sampleFile("quote-bathroom.pdf");
const CHANGE_ORDER = sampleFile("change-order-1.pdf");

describe("the recorded sample response", () => {
  it("is a real response that still matches the schema", () => {
    const parsed = aiResponseSchema.safeParse(seed.response);
    expect(parsed.success).toBe(true);
    expect(seed.recordedAt).toBeTruthy();
    expect(seed.model).toBeTruthy();
  });

  it("reads the documents rather than storing conclusions", () => {
    const parsed = aiResponseSchema.parse(seed.response);

    // What is stored is the model's reading: line items copied from the PDFs.
    expect(parsed.quote?.total).toBe(8000);
    expect(parsed.change_order.total).toBe(2500);
    expect(parsed.quote?.line_items).toHaveLength(8);
    expect(parsed.change_order.line_items).toHaveLength(5);

    // It carries no flags, severities or dollar findings of its own; those
    // only exist once the rule engine has run.
    expect(parsed).not.toHaveProperty("flags");
    expect(parsed).not.toHaveProperty("atStakeCents");
  });

  it("still produces the findings through the live rule engine", () => {
    const parsed = aiResponseSchema.parse(seed.response);
    const { flags, atStakeCents } = runRules({
      quote: parsed.quote!,
      changeOrder: parsed.change_order,
      matches: parsed.matches,
      judgmentFlags: parsed.judgment_flags,
    });

    expect(atStakeCents).toBe(136_000);
    expect(flags.map((flag) => flag.type).sort()).toEqual([
      "allowance_overrun",
      "duplicate_scope",
      "labor_without_scope",
      "math_line",
      "not_signed",
      "payment_terms_changed",
      "schedule_slip",
      "vague_item",
    ]);

    // The headline numbers are computed here, not read from the recording.
    const duplicate = flags.find((flag) => flag.type === "duplicate_scope");
    expect(duplicate?.amountCents).toBe(45_000);
    const math = flags.find((flag) => flag.type === "math_line");
    expect(math?.amountCents).toBe(10_000);
  });
});

describe("the recording cannot answer somebody else's documents", () => {
  it("is keyed to the two sample PDFs under the recorded model", () => {
    expect(cacheKey(seed.model, QUOTE, CHANGE_ORDER)).toBe(seed.key);
  });

  it("misses when either document differs by a single byte", () => {
    const tampered: DocumentInput = {
      kind: "file",
      mimeType: "application/pdf",
      bytes: new Uint8Array([...(QUOTE as { bytes: Uint8Array }).bytes, 0]),
    };

    expect(cacheKey(seed.model, tampered, CHANGE_ORDER)).not.toBe(seed.key);
    expect(cacheKey(seed.model, QUOTE, tampered)).not.toBe(seed.key);
  });

  it("misses for pasted text, even the same words", () => {
    const asText: DocumentInput = {
      kind: "text",
      text: "Estimate #1042 total $8,000.00",
    };
    expect(cacheKey(seed.model, asText, CHANGE_ORDER)).not.toBe(seed.key);
  });

  it("misses when the model changes", () => {
    expect(cacheKey("some-other-model", QUOTE, CHANGE_ORDER)).not.toBe(
      seed.key,
    );
  });
});
