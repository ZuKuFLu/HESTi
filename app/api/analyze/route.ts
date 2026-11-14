import { NextResponse } from "next/server";
import { analyzeDocuments, type DocumentInput } from "@/lib/gemini";
import { runRules } from "@/lib/rules";
import { extractionSchema, type AnalysisResult, type Extraction } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel's request body limit is about 4.5 MB; stay under it. */
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_TEXT_CHARS = 20_000;

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const NOT_RELEVANT_MESSAGE =
  "This doesn't look like a contractor quote or change order.";

type Problem = { status: number; error: string; message: string };

function problem(status: number, error: string, message: string): Problem {
  return { status, error, message };
}

function isProblem(value: unknown): value is Problem {
  return typeof value === "object" && value !== null && "status" in value;
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond(
      problem(400, "bad_request", "We couldn't read that upload. Please try again."),
    );
  }

  const quote = await readQuote(form);
  if (isProblem(quote)) return respond(quote);

  const changeOrder = await readChangeOrder(form);
  if (isProblem(changeOrder)) return respond(changeOrder);

  const totalBytes = sizeOf(quote.input) + sizeOf(changeOrder.input);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return respond(
      problem(
        413,
        "too_large",
        "Those files are too large. Please keep the two documents under 4 MB in total.",
      ),
    );
  }

  let outcome;
  try {
    outcome = await analyzeDocuments(quote.input, changeOrder.input);
  } catch (error) {
    console.error("analyze: unexpected failure", error);
    return respond(
      problem(500, "server_error", "Something went wrong on our side. Please try again."),
    );
  }

  if (!outcome.ok) {
    if (outcome.error === "ai_busy") {
      return respond(
        problem(
          503,
          "ai_busy",
          "Our free AI quota is busy right now. Please try again in a minute.",
        ),
      );
    }
    return respond(
      problem(
        502,
        "ai_invalid",
        "We couldn't read those documents clearly. Please try again.",
      ),
    );
  }

  // When the quote came in as already-extracted JSON the model returns null
  // for it, so fall back to what the browser sent us.
  const quoteExtraction: Extraction | null = outcome.data.quote ?? quote.extraction;
  if (!quoteExtraction) {
    return respond(
      problem(502, "ai_invalid", "We couldn't read your original quote. Please try again."),
    );
  }

  const changeOrderExtraction = outcome.data.change_order;

  if (!quoteExtraction.is_relevant || !changeOrderExtraction.is_relevant) {
    return respond(problem(422, "not_relevant", NOT_RELEVANT_MESSAGE));
  }

  const { flags, atStakeCents } = runRules({
    quote: quoteExtraction,
    changeOrder: changeOrderExtraction,
    matches: outcome.data.matches,
    judgmentFlags: outcome.data.judgment_flags,
  });

  const validCoIds = new Set(changeOrderExtraction.line_items.map((line) => line.id));
  const validQuoteIds = new Set(quoteExtraction.line_items.map((line) => line.id));

  const result: AnalysisResult = {
    quote: quoteExtraction,
    changeOrder: changeOrderExtraction,
    matches: outcome.data.matches.filter(
      (match) =>
        validCoIds.has(match.co_line_id) &&
        (match.quote_line_id === null || validQuoteIds.has(match.quote_line_id)),
    ),
    flags,
    atStakeCents,
  };

  return NextResponse.json(result);
}

/** The quote arrives as a file, pasted text, or JSON we extracted earlier. */
async function readQuote(
  form: FormData,
): Promise<Problem | { input: DocumentInput; extraction: Extraction | null }> {
  const json = form.get("quoteJson");
  if (typeof json === "string" && json.trim()) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return problem(400, "bad_request", "We couldn't read that saved quote.");
    }
    const validated = extractionSchema.safeParse(parsed);
    if (!validated.success) {
      return problem(400, "bad_request", "We couldn't read that saved quote.");
    }
    return {
      input: { kind: "json", json: JSON.stringify(validated.data) },
      extraction: validated.data,
    };
  }

  const document = await readDocument(form, "quoteFile", "quoteText", "original quote");
  if (isProblem(document)) return document;
  return { input: document, extraction: null };
}

async function readChangeOrder(
  form: FormData,
): Promise<Problem | { input: DocumentInput; extraction: null }> {
  const document = await readDocument(form, "coFile", "coText", "change order");
  if (isProblem(document)) return document;
  return { input: document, extraction: null };
}

async function readDocument(
  form: FormData,
  fileField: string,
  textField: string,
  label: string,
): Promise<Problem | DocumentInput> {
  const file = form.get(fileField);
  if (file instanceof File && file.size > 0) {
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      return problem(
        400,
        "bad_file_type",
        `Your ${label} needs to be a PDF, JPG, PNG or WebP file.`,
      );
    }
    if (file.size > MAX_TOTAL_BYTES) {
      return problem(413, "too_large", `Your ${label} is too large. Please keep it under 4 MB.`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { kind: "file", mimeType: file.type, bytes };
  }

  const text = form.get(textField);
  if (typeof text === "string" && text.trim()) {
    if (text.length > MAX_TEXT_CHARS) {
      return problem(
        400,
        "text_too_long",
        `That ${label} is too long. Please paste up to ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters.`,
      );
    }
    return { kind: "text", text: text.trim() };
  }

  return problem(400, "missing_document", `Please add your ${label}.`);
}

function sizeOf(input: DocumentInput): number {
  if (input.kind === "file") return input.bytes.byteLength;
  if (input.kind === "text") return Buffer.byteLength(input.text, "utf8");
  return Buffer.byteLength(input.json, "utf8");
}

function respond(p: Problem) {
  return NextResponse.json({ error: p.error, message: p.message }, { status: p.status });
}
