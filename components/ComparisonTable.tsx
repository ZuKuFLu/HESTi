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

const RELATION_LABELS: Record<
  Match["relation"],
  { label: string; className: string }
> = {
  new: { label: "New", className: "bg-muted text-muted-foreground" },
  changed: { label: "Changed", className: "bg-medium-bg text-medium" },
  already_included: {
    label: "Already in quote?",
    className: "bg-high-bg text-high",
  },
  allowance_adjustment: {
    label: "Allowance",
    className: "bg-info-bg text-info",
  },
  unclear: { label: "Unclear", className: "bg-muted text-muted-foreground" },
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
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-14 text-xs tracking-wide uppercase">
            Line
          </TableHead>
          <TableHead className="w-[36%] text-xs tracking-wide uppercase">
            Description
          </TableHead>
          <TableHead className="w-24 text-right text-xs tracking-wide uppercase">
            Amount
          </TableHead>
          <TableHead className="w-36 text-xs tracking-wide uppercase">
            Status
          </TableHead>
          <TableHead className="w-[26%] text-xs tracking-wide uppercase">
            Matched quote line
          </TableHead>
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
            <TableRow key={line.id} className="odd:bg-muted/40">
              <TableCell className="align-top font-mono text-xs text-muted-foreground">
                {line.id}
              </TableCell>
              <TableCell className="align-top wrap-anywhere whitespace-normal">
                {line.description}
              </TableCell>
              <TableCell className="align-top text-right font-medium tabular-nums">
                {line.total !== null
                  ? formatUsd(toCentsOrZero(line.total))
                  : "—"}
              </TableCell>
              <TableCell className="align-top">
                <span
                  className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
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
