import { Card, CardContent } from "@/components/ui/card";
import { formatUsd, toCentsOrZero } from "@/lib/money";
import type { Extraction, Flag, LineItem, Severity } from "@/lib/schemas";

const SEVERITY_STYLES: Record<Severity, { badge: string; card: string; label: string }> = {
  high: {
    badge: "bg-red-100 text-red-900 ring-red-200",
    card: "border-l-red-500",
    label: "High",
  },
  medium: {
    badge: "bg-amber-100 text-amber-900 ring-amber-200",
    card: "border-l-amber-500",
    label: "Medium",
  },
  info: {
    badge: "bg-blue-100 text-blue-900 ring-blue-200",
    card: "border-l-blue-500",
    label: "Info",
  },
};

export function FlagCard({
  flag,
  quote,
  changeOrder,
}: {
  flag: Flag;
  quote: Extraction;
  changeOrder: Extraction;
}) {
  const styles = SEVERITY_STYLES[flag.severity];
  const coEvidence = resolve(changeOrder.line_items, flag.coLineIds);
  const quoteEvidence = resolve(quote.line_items, flag.quoteLineIds);
  const hasEvidence = coEvidence.length > 0 || quoteEvidence.length > 0;

  return (
    <Card className={`border-l-4 ${styles.card}`}>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles.badge}`}
            >
              {styles.label}
            </span>
            <h3 className="text-base font-semibold">{flag.title}</h3>
          </div>
          {flag.amountCents > 0 ? (
            <span className="text-base font-semibold tabular-nums">
              {formatUsd(flag.amountCents)}
            </span>
          ) : null}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{flag.explanation}</p>

        {hasEvidence ? (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evidence
            </p>
            <ul className="space-y-1.5 text-sm">
              {coEvidence.map((line) => (
                <EvidenceRow key={`co-${line.id}`} source="Change order" line={line} />
              ))}
              {quoteEvidence.map((line) => (
                <EvidenceRow key={`q-${line.id}`} source="Original quote" line={line} />
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ask your contractor
          </p>
          <p className="mt-1 text-sm leading-relaxed">{flag.question}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceRow({ source, line }: { source: string; line: LineItem }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-xs text-muted-foreground">{source}</span>
      <span className="min-w-0 flex-1">{line.description}</span>
      {line.total !== null ? (
        <span className="tabular-nums">{formatUsd(toCentsOrZero(line.total))}</span>
      ) : null}
    </li>
  );
}

function resolve(lines: LineItem[], ids: string[]): LineItem[] {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  return lines.filter((line) => wanted.has(line.id));
}
