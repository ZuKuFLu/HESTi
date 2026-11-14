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

  // The table keeps a 640px minimum and scrolls sideways on a phone rather
  // than crushing five columns into 375px.
  return (
    <Table className="min-w-[640px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">Line</TableHead>
          <TableHead className="w-[36%]">Description</TableHead>
          <TableHead className="w-24 text-right">Amount</TableHead>
          <TableHead className="w-36">Status</TableHead>
          <TableHead className="w-[26%]">Matched quote line</TableHead>
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
                <TableCell className="align-top font-mono text-xs text-muted-foreground">
                  {line.id}
                </TableCell>
                <TableCell className="align-top wrap-anywhere whitespace-normal">
                  {line.description}
                </TableCell>
                <TableCell className="align-top text-right tabular-nums">
                  {line.total !== null ? formatUsd(toCentsOrZero(line.total)) : "—"}
                </TableCell>
                <TableCell className="align-top">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </TableCell>
                <TableCell className="align-top wrap-anywhere whitespace-normal text-sm text-muted-foreground">
                  {quoteLine ? quoteLine.description : "—"}
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}
