import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUsd, toCentsOrZero } from "@/lib/money";
import type { Extraction, Match } from "@/lib/schemas";

const RELATION_LABELS: Record<Match["relation"], { label: string; className: string }> = {
  new: { label: "New", className: "bg-slate-100 text-slate-800 ring-slate-200" },
  changed: { label: "Changed", className: "bg-amber-100 text-amber-900 ring-amber-200" },
  already_included: {
    label: "Already in quote?",
    className: "bg-red-100 text-red-900 ring-red-200",
  },
  allowance_adjustment: {
    label: "Allowance",
    className: "bg-blue-100 text-blue-900 ring-blue-200",
  },
  unclear: { label: "Unclear", className: "bg-slate-100 text-slate-800 ring-slate-200" },
};

export function ComparisonTable({
  quote,
  changeOrder,
  matches,
}: {
  quote: Extraction;
  changeOrder: Extraction;
  matches: Match[];
}) {
  const byCoLine = new Map(matches.map((match) => [match.co_line_id, match]));
  const quoteLines = new Map(quote.line_items.map((line) => [line.id, line]));

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Line</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Matched quote line</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changeOrder.line_items.map((line) => {
            const match = byCoLine.get(line.id);
            const relation = match?.relation ?? "unclear";
            const badge = RELATION_LABELS[relation];
            const quoteLine = match?.quote_line_id
              ? quoteLines.get(match.quote_line_id)
              : undefined;

            return (
              <TableRow key={line.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {line.id}
                </TableCell>
                <TableCell className="max-w-[320px]">{line.description}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {line.total !== null ? formatUsd(toCentsOrZero(line.total)) : "—"}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {quoteLine ? quoteLine.description : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
