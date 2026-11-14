import { formatUsd, parseDate, toCents, toCentsOrZero } from "@/lib/money";
import type {
  Extraction,
  Flag,
  JudgmentFlag,
  LineItem,
  Match,
  PaymentTerm,
  Severity,
} from "@/lib/schemas";

/**
 * The rule engine. Pure: no I/O, no clock, no randomness — the same inputs
 * always give the same flags, which is what makes the result checkable.
 *
 * The model is never asked to do arithmetic. It copies the numbers it sees;
 * every comparison below runs here, in integer cents.
 */

/** Differences at or under a dollar are rounding, not a problem. */
const TOLERANCE_CENTS = 100;

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, info: 2 };

/** A flag plus the per-line amounts it puts at stake, used for "$ at stake". */
type ScoredFlag = {
  flag: Flag;
  /** CO line id -> cents this flag puts at stake on that line. */
  perLine: { lineId: string; cents: number }[];
  /** Amounts not tied to a single line (the total mismatch). */
  looseCents: number;
};

export type RuleInput = {
  quote: Extraction;
  changeOrder: Extraction;
  matches: Match[];
  judgmentFlags: JudgmentFlag[];
};

export type RuleOutput = {
  flags: Flag[];
  atStakeCents: number;
};

/**
 * Drops any match or judgment flag that cites a line id neither document
 * contains, so a hallucinated reference can never reach the report.
 */
export function sanitize(input: RuleInput): RuleInput {
  const quoteIds = new Set(input.quote.line_items.map((line) => line.id));
  const coIds = new Set(input.changeOrder.line_items.map((line) => line.id));

  return {
    quote: input.quote,
    changeOrder: input.changeOrder,
    matches: input.matches.filter(
      (match) =>
        coIds.has(match.co_line_id) &&
        (match.quote_line_id === null || quoteIds.has(match.quote_line_id)),
    ),
    judgmentFlags: input.judgmentFlags
      .map((flag) => ({
        ...flag,
        co_line_ids: flag.co_line_ids.filter((id) => coIds.has(id)),
      }))
      .filter((flag) => flag.co_line_ids.length > 0),
  };
}

export function runRules(rawInput: RuleInput): RuleOutput {
  const input = sanitize(rawInput);
  const { quote, changeOrder, matches, judgmentFlags } = input;

  const coLines = new Map(changeOrder.line_items.map((line) => [line.id, line]));
  const quoteLines = new Map(quote.line_items.map((line) => [line.id, line]));

  const scored: ScoredFlag[] = [
    ...mathLineFlags(changeOrder.line_items),
    ...mathTotalFlags(changeOrder),
    ...duplicateScopeFlags(matches, coLines, quoteLines),
    ...judgmentFlagsToFlags(judgmentFlags, coLines),
    ...paymentTermsFlags(changeOrder),
    ...allowanceFlags(matches, coLines, quoteLines),
    ...scheduleFlags(quote, changeOrder),
    ...notSignedFlags(changeOrder),
  ];

  return {
    flags: sortFlags(scored.map((entry) => entry.flag)),
    atStakeCents: atStake(scored),
  };
}

/**
 * $ at stake: each CO line contributes once, at the largest amount any of its
 * high/medium flags puts on it, plus any total mismatch. Summing every flag
 * instead would double-count a line that is both duplicated and mis-added.
 */
function atStake(scored: ScoredFlag[]): number {
  const perLineMax = new Map<string, number>();
  let loose = 0;

  for (const entry of scored) {
    loose += entry.looseCents;
    if (entry.flag.severity === "info") continue;
    for (const { lineId, cents } of entry.perLine) {
      perLineMax.set(lineId, Math.max(perLineMax.get(lineId) ?? 0, cents));
    }
  }

  let total = loose;
  for (const cents of perLineMax.values()) total += cents;
  return total;
}

function sortFlags(flags: Flag[]): Flag[] {
  return [...flags].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return b.amountCents - a.amountCents;
  });
}

// --- individual rules -------------------------------------------------------

function mathLineFlags(lines: LineItem[]): ScoredFlag[] {
  const out: ScoredFlag[] = [];

  for (const line of lines) {
    const qty = line.qty;
    const unitPriceCents = toCents(line.unit_price);
    const totalCents = toCents(line.total);
    if (qty === null || unitPriceCents === null || totalCents === null) continue;

    const expectedCents = Math.round(qty * unitPriceCents);
    const diff = Math.abs(expectedCents - totalCents);
    if (diff <= TOLERANCE_CENTS) continue;

    const unit = line.unit ? ` ${line.unit}` : "";
    out.push({
      flag: {
        id: `math_line:${line.id}`,
        type: "math_line",
        severity: "high",
        title: "The math on this line doesn't add up",
        amountCents: diff,
        coLineIds: [line.id],
        quoteLineIds: [],
        explanation: `"${line.description}" is billed as ${qty}${unit} at ${formatUsd(unitPriceCents)} each, which comes to ${formatUsd(expectedCents)}, but the line total reads ${formatUsd(totalCents)}. That is a difference of ${formatUsd(diff)}.`,
        question: `On "${line.description}", ${qty}${unit} at ${formatUsd(unitPriceCents)} each works out to ${formatUsd(expectedCents)}, but the line says ${formatUsd(totalCents)}. Could you correct this or explain the difference?`,
        source: "rule",
      },
      perLine: [{ lineId: line.id, cents: diff }],
      looseCents: 0,
    });
  }

  return out;
}

function mathTotalFlags(changeOrder: Extraction): ScoredFlag[] {
  const statedCents = toCents(changeOrder.total);
  if (statedCents === null || changeOrder.line_items.length === 0) return [];

  const summedCents = changeOrder.line_items.reduce(
    (sum, line) => sum + toCentsOrZero(line.total),
    0,
  );
  const diff = Math.abs(summedCents - statedCents);
  if (diff <= TOLERANCE_CENTS) return [];

  const direction = statedCents > summedCents ? "more than" : "less than";

  return [
    {
      flag: {
        id: "math_total",
        type: "math_total",
        severity: "high",
        title: "The lines don't add up to the stated total",
        amountCents: diff,
        coLineIds: changeOrder.line_items.map((line) => line.id),
        quoteLineIds: [],
        explanation: `The individual lines on this change order add up to ${formatUsd(summedCents)}, but the stated total is ${formatUsd(statedCents)} — ${formatUsd(diff)} ${direction} the lines come to.`,
        question: `The lines on this change order add up to ${formatUsd(summedCents)}, but the total reads ${formatUsd(statedCents)}. Which figure is correct, and what accounts for the ${formatUsd(diff)} difference?`,
        source: "rule",
      },
      perLine: [],
      looseCents: diff,
    },
  ];
}

function duplicateScopeFlags(
  matches: Match[],
  coLines: Map<string, LineItem>,
  quoteLines: Map<string, LineItem>,
): ScoredFlag[] {
  const out: ScoredFlag[] = [];

  for (const match of matches) {
    if (match.relation !== "already_included") continue;
    const coLine = coLines.get(match.co_line_id);
    if (!coLine) continue;

    const amountCents = toCentsOrZero(coLine.total);
    const quoteLine = match.quote_line_id ? quoteLines.get(match.quote_line_id) : undefined;
    const quoteReference = quoteLine
      ? `"${quoteLine.description}"${quoteLine.total !== null ? ` (${formatUsd(toCentsOrZero(quoteLine.total))})` : ""}`
      : "work already covered by your original quote";

    out.push({
      flag: {
        id: `duplicate_scope:${coLine.id}`,
        type: "duplicate_scope",
        severity: "high",
        title: "You may be charged twice for this",
        amountCents,
        coLineIds: [coLine.id],
        quoteLineIds: quoteLine ? [quoteLine.id] : [],
        explanation: `This change order bills ${formatUsd(amountCents)} for "${coLine.description}", but your original quote already includes ${quoteReference}.`,
        question: `Your original quote already covers ${quoteReference}. Why is "${coLine.description}" being charged again at ${formatUsd(amountCents)}?`,
        source: "rule",
      },
      perLine: [{ lineId: coLine.id, cents: amountCents }],
      looseCents: 0,
    });
  }

  return out;
}

/**
 * The two judgment calls the model makes. The wording is the model's, because
 * these are readings of the document rather than arithmetic; the amount and
 * the severity are still decided here.
 */
function judgmentFlagsToFlags(
  judgmentFlags: JudgmentFlag[],
  coLines: Map<string, LineItem>,
): ScoredFlag[] {
  const out: ScoredFlag[] = [];

  judgmentFlags.forEach((judgment, index) => {
    const lines = judgment.co_line_ids
      .map((id) => coLines.get(id))
      .filter((line): line is LineItem => line !== undefined);
    if (lines.length === 0) return;

    const perLine = lines.map((line) => ({
      lineId: line.id,
      cents: toCentsOrZero(line.total),
    }));
    const amountCents = perLine.reduce((sum, entry) => sum + entry.cents, 0);

    out.push({
      flag: {
        id: `${judgment.type}:${index}:${lines.map((line) => line.id).join("-")}`,
        type: judgment.type,
        severity: "medium",
        title:
          judgment.type === "vague_item"
            ? "This line is too vague to check"
            : "Labor charged without saying what for",
        amountCents,
        coLineIds: lines.map((line) => line.id),
        quoteLineIds: [],
        explanation: judgment.explanation,
        question: judgment.question,
        source: "ai",
      },
      perLine,
      looseCents: 0,
    });
  });

  return out;
}

function paymentTermsFlags(changeOrder: Extraction): ScoredFlag[] {
  const coTotalCents = toCents(changeOrder.total);

  for (const term of changeOrder.payment_terms) {
    const text = `${term.label} ${term.due ?? ""}`.toLowerCase();
    const afterCompletion = /completion|complete|final|substantial|punch/.test(text);
    if (afterCompletion) continue;

    const amountCents = toCents(term.amount);
    const demandsMostUpFront =
      (term.percent !== null && term.percent >= 50) ||
      /\bin full\b/.test(text) ||
      (amountCents !== null &&
        coTotalCents !== null &&
        coTotalCents > 0 &&
        amountCents * 2 >= coTotalCents);
    if (!demandsMostUpFront) continue;

    return [
      {
        flag: {
          id: "payment_terms_changed",
          type: "payment_terms_changed",
          severity: "medium",
          title: "Payment is due before the work is done",
          amountCents: 0,
          coLineIds: [],
          quoteLineIds: [],
          explanation: `This change order asks for payment up front: "${describeTerm(term)}". Your original quote held part of the money back until completion, which is the usual protection if the work isn't finished properly.`,
          question: `Can payment for this change order follow the same schedule as the original quote, with part of it held until the work is complete?`,
          source: "rule",
        },
        perLine: [],
        looseCents: 0,
      },
    ];
  }

  return [];
}

function allowanceFlags(
  matches: Match[],
  coLines: Map<string, LineItem>,
  quoteLines: Map<string, LineItem>,
): ScoredFlag[] {
  const out: ScoredFlag[] = [];

  for (const match of matches) {
    if (match.relation !== "allowance_adjustment") continue;
    const coLine = coLines.get(match.co_line_id);
    if (!coLine) continue;

    const quoteLine = match.quote_line_id ? quoteLines.get(match.quote_line_id) : undefined;
    const allowanceCents = quoteLine
      ? toCents(quoteLine.allowance_amount) ?? toCents(quoteLine.total)
      : null;
    const against =
      quoteLine && allowanceCents !== null
        ? ` against the ${formatUsd(allowanceCents)} allowance for "${quoteLine.description}"`
        : "";

    out.push({
      flag: {
        id: `allowance_overrun:${coLine.id}`,
        type: "allowance_overrun",
        severity: "info",
        title: "Allowance adjustment",
        amountCents: 0,
        coLineIds: [coLine.id],
        quoteLineIds: quoteLine ? [quoteLine.id] : [],
        explanation: `"${coLine.description}" charges the difference between an allowance in your quote and what was actually selected. Going over an allowance is usually legitimate — it is worth confirming the price.`,
        question: `Could you show the selected product and its price${against}, so I can see how the difference was worked out?`,
        source: "rule",
      },
      perLine: [],
      looseCents: 0,
    });
  }

  return out;
}

function scheduleFlags(quote: Extraction, changeOrder: Extraction): ScoredFlag[] {
  const quoteEnd = parseDate(quote.schedule.end_date);
  const coEnd = parseDate(changeOrder.schedule.end_date);
  if (!quoteEnd || !coEnd) return [];
  if (coEnd.getTime() <= quoteEnd.getTime()) return [];
  if (changeOrder.schedule.change_reason) return [];

  const days = Math.round((coEnd.getTime() - quoteEnd.getTime()) / 86_400_000);

  return [
    {
      flag: {
        id: "schedule_slip",
        type: "schedule_slip",
        severity: "info",
        title: "The completion date moved, with no reason given",
        amountCents: 0,
        coLineIds: [],
        quoteLineIds: [],
        explanation: `Your quote had the job finishing on ${formatDateUs(quoteEnd)}. This change order moves completion to ${formatDateUs(coEnd)}, ${days} ${days === 1 ? "day" : "days"} later, without saying why.`,
        question: `The completion date has moved from ${formatDateUs(quoteEnd)} to ${formatDateUs(coEnd)}. What caused the delay, and is the new date firm?`,
        source: "rule",
      },
      perLine: [],
      looseCents: 0,
    },
  ];
}

function notSignedFlags(changeOrder: Extraction): ScoredFlag[] {
  if (changeOrder.has_signature_or_approval !== false) return [];

  return [
    {
      flag: {
        id: "not_signed",
        type: "not_signed",
        severity: "info",
        title: "Nobody has approved this yet",
        amountCents: 0,
        coLineIds: [],
        quoteLineIds: [],
        explanation: `This change order has no signature or approval on it. Until you sign, you have not agreed to the extra cost — which means you still have room to ask questions.`,
        question: `Before I sign, could you walk me through the items above?`,
        source: "rule",
      },
      perLine: [],
      looseCents: 0,
    },
  ];
}

// --- small helpers ----------------------------------------------------------

/**
 * The model often splits "due in full upon signing" into a label and a due
 * field; quoting only the label back at the homeowner reads like a fragment.
 */
function describeTerm(term: PaymentTerm): string {
  const label = term.label.trim();
  const due = term.due?.trim();
  if (!due) return label;
  if (label.toLowerCase().includes(due.toLowerCase())) return label;
  return `${label} — ${due}`;
}

function formatDateUs(date: Date): string {
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${date.getUTCFullYear()}`;
}
