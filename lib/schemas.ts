import { Type, type Schema } from "@google/genai";
import { z } from "zod";

/**
 * Everything the model is allowed to return, and the shapes we persist.
 *
 * Amounts here are DOLLARS, exactly as the model copied them from the
 * document. Nothing in this file does arithmetic — conversion to integer cents
 * happens in lib/rules.ts and lib/money.ts.
 */

export const CATEGORIES = [
  "demolition",
  "plumbing",
  "electrical",
  "waterproofing",
  "tile",
  "fixtures",
  "labor",
  "permit",
  "materials",
  "other",
] as const;

export const RELATIONS = [
  "new",
  "changed",
  "already_included",
  "allowance_adjustment",
  "unclear",
] as const;

export const JUDGMENT_TYPES = ["vague_item", "labor_without_scope"] as const;

/** The model sometimes omits an optional field rather than sending null. */
const nullableNumber = z.number().nullish().transform((v) => v ?? null);
const nullableString = z.string().nullish().transform((v) => v ?? null);
const nullableBoolean = z.boolean().nullish().transform((v) => v ?? null);

export const lineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.enum(CATEGORIES).catch("other"),
  qty: nullableNumber,
  unit: nullableString,
  unit_price: nullableNumber,
  total: nullableNumber,
  is_allowance: z.boolean().nullish().transform((v) => v ?? false),
  allowance_amount: nullableNumber,
});

export const paymentTermSchema = z.object({
  label: z.string(),
  amount: nullableNumber,
  percent: nullableNumber,
  due: nullableString,
});

export const extractionSchema = z.object({
  is_relevant: z.boolean(),
  contractor_name: nullableString,
  document_number: nullableString,
  document_date: nullableString,
  line_items: z.array(lineItemSchema),
  subtotal: nullableNumber,
  total: nullableNumber,
  schedule: z
    .object({
      start_date: nullableString,
      end_date: nullableString,
      change_reason: nullableString,
    })
    .nullish()
    .transform((v) => v ?? { start_date: null, end_date: null, change_reason: null }),
  payment_terms: z
    .array(paymentTermSchema)
    .nullish()
    .transform((v) => v ?? []),
  has_signature_or_approval: nullableBoolean,
});

export const matchSchema = z.object({
  co_line_id: z.string(),
  quote_line_id: nullableString,
  relation: z.enum(RELATIONS).catch("unclear"),
  reason: z.string(),
});

export const judgmentFlagSchema = z.object({
  type: z.enum(JUDGMENT_TYPES),
  co_line_ids: z.array(z.string()),
  explanation: z.string(),
  question: z.string(),
});

export const aiResponseSchema = z.object({
  quote: extractionSchema.nullish().transform((v) => v ?? null),
  change_order: extractionSchema,
  matches: z
    .array(matchSchema)
    .nullish()
    .transform((v) => v ?? []),
  judgment_flags: z
    .array(judgmentFlagSchema)
    .nullish()
    .transform((v) => v ?? []),
});

export type LineItem = z.infer<typeof lineItemSchema>;
export type PaymentTerm = z.infer<typeof paymentTermSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type Match = z.infer<typeof matchSchema>;
export type JudgmentFlag = z.infer<typeof judgmentFlagSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;

export type FlagType =
  | "math_line"
  | "math_total"
  | "duplicate_scope"
  | "labor_without_scope"
  | "vague_item"
  | "payment_terms_changed"
  | "allowance_overrun"
  | "schedule_slip"
  | "not_signed";

export type Severity = "high" | "medium" | "info";

export type Flag = {
  id: string;
  type: FlagType;
  severity: Severity;
  title: string;
  amountCents: number;
  coLineIds: string[];
  quoteLineIds: string[];
  explanation: string;
  question: string;
  source: "rule" | "ai";
};

export type AnalysisResult = {
  quote: Extraction;
  changeOrder: Extraction;
  matches: Match[];
  flags: Flag[];
  atStakeCents: number;
  /**
   * True when the model's reading of these documents came from the recorded
   * sample response instead of a live call. The flags, amounts and report are
   * computed live either way. Shown to the reader rather than hidden.
   */
  prepared?: boolean;
};

// --- Gemini response schema -------------------------------------------------
// Mirrors the zod schemas above. Kept adjacent so the two cannot drift apart
// unnoticed; the zod parse is still the gate, because the model can ignore it.

const nullableNumberSchema: Schema = { type: Type.NUMBER, nullable: true };
const nullableStringSchema: Schema = { type: Type.STRING, nullable: true };

const lineItemGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    description: { type: Type.STRING },
    category: { type: Type.STRING, enum: [...CATEGORIES] },
    qty: nullableNumberSchema,
    unit: nullableStringSchema,
    unit_price: nullableNumberSchema,
    total: nullableNumberSchema,
    is_allowance: { type: Type.BOOLEAN },
    allowance_amount: nullableNumberSchema,
  },
  propertyOrdering: [
    "id",
    "description",
    "category",
    "qty",
    "unit",
    "unit_price",
    "total",
    "is_allowance",
    "allowance_amount",
  ],
  required: [
    "id",
    "description",
    "category",
    "qty",
    "unit",
    "unit_price",
    "total",
    "is_allowance",
    "allowance_amount",
  ],
};

const extractionGeminiSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    is_relevant: { type: Type.BOOLEAN },
    contractor_name: nullableStringSchema,
    document_number: nullableStringSchema,
    document_date: nullableStringSchema,
    line_items: { type: Type.ARRAY, items: lineItemGeminiSchema },
    subtotal: nullableNumberSchema,
    total: nullableNumberSchema,
    schedule: {
      type: Type.OBJECT,
      properties: {
        start_date: nullableStringSchema,
        end_date: nullableStringSchema,
        change_reason: nullableStringSchema,
      },
      propertyOrdering: ["start_date", "end_date", "change_reason"],
      required: ["start_date", "end_date", "change_reason"],
    },
    payment_terms: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          amount: nullableNumberSchema,
          percent: nullableNumberSchema,
          due: nullableStringSchema,
        },
        propertyOrdering: ["label", "amount", "percent", "due"],
        required: ["label", "amount", "percent", "due"],
      },
    },
    has_signature_or_approval: { type: Type.BOOLEAN, nullable: true },
  },
  propertyOrdering: [
    "is_relevant",
    "contractor_name",
    "document_number",
    "document_date",
    "line_items",
    "subtotal",
    "total",
    "schedule",
    "payment_terms",
    "has_signature_or_approval",
  ],
  required: [
    "is_relevant",
    "contractor_name",
    "document_number",
    "document_date",
    "line_items",
    "subtotal",
    "total",
    "schedule",
    "payment_terms",
    "has_signature_or_approval",
  ],
};

/**
 * `quote` is nullable because a follow-up change order sends the already
 * extracted quote as JSON, and re-emitting it would waste the one call.
 */
export const geminiResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    quote: { ...extractionGeminiSchema, nullable: true },
    change_order: extractionGeminiSchema,
    matches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          co_line_id: { type: Type.STRING },
          quote_line_id: nullableStringSchema,
          relation: { type: Type.STRING, enum: [...RELATIONS] },
          reason: { type: Type.STRING },
        },
        propertyOrdering: ["co_line_id", "quote_line_id", "relation", "reason"],
        required: ["co_line_id", "quote_line_id", "relation", "reason"],
      },
    },
    judgment_flags: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: [...JUDGMENT_TYPES] },
          co_line_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
          explanation: { type: Type.STRING },
          question: { type: Type.STRING },
        },
        propertyOrdering: ["type", "co_line_ids", "explanation", "question"],
        required: ["type", "co_line_ids", "explanation", "question"],
      },
    },
  },
  propertyOrdering: ["quote", "change_order", "matches", "judgment_flags"],
  required: ["change_order", "matches", "judgment_flags"],
};
