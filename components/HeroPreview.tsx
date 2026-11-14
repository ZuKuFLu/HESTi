import { AtStakeCard } from "@/components/AtStakeCard";
import { FlagCard } from "@/components/FlagCard";
import type { Extraction, Flag, LineItem, Severity } from "@/lib/schemas";

/**
 * A still of a real report, assembled from the same AtStakeCard and FlagCard
 * the product renders — so the home page cannot drift from the thing it is
 * advertising.
 *
 * The values come from the sample documents in /public/samples and are
 * labelled as an example on screen. Nothing here touches the analysis path:
 * a real run always goes through /api/analyze.
 */

function line(id: string, description: string, total: number | null): LineItem {
  return {
    id,
    description,
    category: "other",
    qty: null,
    unit: null,
    unit_price: null,
    total,
    is_allowance: false,
    allowance_amount: null,
  };
}

function extraction(lines: LineItem[]): Extraction {
  return {
    is_relevant: true,
    contractor_name: "Summit Home Renovations LLC",
    document_number: null,
    document_date: null,
    line_items: lines,
    subtotal: null,
    total: null,
    schedule: { start_date: null, end_date: null, change_reason: null },
    payment_terms: [],
    has_signature_or_approval: null,
  };
}

const EXAMPLE_QUOTE = extraction([
  line(
    "Q3",
    "Shower pan, cement board and waterproofing membrane (walls and floor)",
    650,
  ),
]);

const EXAMPLE_CHANGE_ORDER = extraction([
  line("C2", "Waterproofing membrane for shower walls", 450),
]);

/** Severity mix of the sample report, used only for the count pills. */
const PILL_MIX: Severity[] = [
  "high",
  "high",
  "medium",
  "medium",
  "medium",
  "info",
  "info",
  "info",
];

const EXAMPLE_FLAGS: Flag[] = PILL_MIX.map((severity, index) => ({
  id: `example-${index}`,
  type: "duplicate_scope",
  severity,
  title: "",
  amountCents: 0,
  coLineIds: [],
  quoteLineIds: [],
  explanation: "",
  question: "",
  source: "rule",
}));

const EXAMPLE_FLAG: Flag = {
  id: "example-duplicate",
  type: "duplicate_scope",
  severity: "high",
  title: "You may be charged twice for this",
  amountCents: 45_000,
  coLineIds: ["C2"],
  quoteLineIds: ["Q3"],
  explanation:
    'This change order bills $450.00 for "Waterproofing membrane for shower walls", but your original quote already includes "Shower pan, cement board and waterproofing membrane (walls and floor)" ($650.00).',
  question:
    "Your original quote already covers the shower waterproofing. Why is the membrane for the shower walls being charged again at $450.00?",
  source: "rule",
};

export function HeroPreview() {
  return (
    <div
      aria-label="Example report"
      className="space-y-3 rounded-3xl bg-card/60 p-3 ring-1 ring-foreground/10 backdrop-blur-sm sm:p-4"
    >
      <p className="flex items-center gap-2 px-1 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        <span className="size-1.5 rounded-full bg-primary" />
        Example — from the sample documents
      </p>
      <AtStakeCard atStakeCents={136_000} flags={EXAMPLE_FLAGS} compact />
      <FlagCard
        flag={EXAMPLE_FLAG}
        quote={EXAMPLE_QUOTE}
        changeOrder={EXAMPLE_CHANGE_ORDER}
      />
    </div>
  );
}
