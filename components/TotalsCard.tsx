import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatUsd } from "@/lib/money";
import {
  computeTotals,
  type ChangeOrderStatus,
  type Project,
} from "@/lib/projects";

export function TotalsCard({ project }: { project: Project }) {
  const totals = computeTotals(project);
  const worstCase = computeTotals(project, true);
  const overCents = Math.max(0, totals.currentCents - totals.originalCents);
  const undecidedCents = totals.pendingCents + totals.disputedCents;

  // The bar is the current total. The filled part is what was originally
  // quoted; the terracotta tail is everything added since.
  const originalShare =
    totals.currentCents > 0
      ? Math.max(
          0,
          Math.min(100, (totals.originalCents / totals.currentCents) * 100),
        )
      : 100;

  return (
    <Card className="ring-foreground/10">
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Where this project stands
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              {formatUsd(totals.currentCents)}
            </p>
          </div>
          {totals.originalCents > 0 ? (
            <div className="flex items-center gap-2 rounded-full bg-medium-bg px-3 py-1.5 text-medium">
              <TrendingUp className="size-4" />
              <span className="text-sm font-semibold tabular-nums">
                {totals.percentOver}
              </span>
              <span className="text-sm">over the original quote</span>
            </div>
          ) : null}
        </div>

        {totals.originalCents > 0 ? (
          <div className="space-y-2">
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${formatUsd(totals.originalCents)} originally quoted, ${formatUsd(overCents)} added since`}
            >
              <div
                className="h-full bg-foreground/80"
                style={{ width: `${originalShare}%` }}
              />
              <div className="h-full flex-1 bg-primary" />
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-foreground/80" />
                Original quote {formatUsd(totals.originalCents)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" />
                Added since {formatUsd(overCents)}
              </span>
            </div>
          </div>
        ) : null}

        <dl className="divide-y divide-border/70 border-t border-border/70 text-sm">
          <Row label="Original quote" value={formatUsd(totals.originalCents)} />
          {project.changeOrders.map((order, index) => (
            <Row
              key={order.id}
              label={`Change order ${index + 1}`}
              sublabel={formatDate(order.extraction.document_date) ?? undefined}
              status={order.status}
              value={formatUsd(totals.changeOrderCents[index])}
              muted={order.status !== "approved"}
            />
          ))}
          <div className="flex items-baseline justify-between gap-4 pt-3 text-base font-semibold">
            <dt>Current total</dt>
            <dd className="tabular-nums">{formatUsd(totals.currentCents)}</dd>
          </div>
        </dl>

        {undecidedCents > 0 ? (
          <div className="space-y-2 rounded-xl bg-muted/70 p-4 text-sm ring-1 ring-foreground/5 ring-inset">
            <p className="text-xs text-muted-foreground">
              Not in the total above, because you haven&apos;t approved it yet:
            </p>
            {totals.pendingCents > 0 ? (
              <div className="flex items-baseline justify-between gap-4">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-medium-line" />
                  Pending
                </span>
                <span className="font-medium tabular-nums">
                  {formatUsd(totals.pendingCents)}
                </span>
              </div>
            ) : null}
            {totals.disputedCents > 0 ? (
              <div className="flex items-baseline justify-between gap-4">
                <span className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-high-line" />
                  Disputed
                </span>
                <span className="font-medium tabular-nums">
                  {formatUsd(totals.disputedCents)}
                </span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-4 border-t border-border/70 pt-2 text-muted-foreground">
              <span>If you approve everything</span>
              <span className="font-medium tabular-nums">
                {formatUsd(worstCase.currentCents)} ({worstCase.percentOver})
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const STATUS_STYLES: Record<ChangeOrderStatus, string> = {
  pending: "bg-medium-bg text-medium",
  approved: "bg-primary/10 text-primary",
  disputed: "bg-high-bg text-high",
};

function Row({
  label,
  sublabel,
  status,
  value,
  muted = false,
}: {
  label: string;
  sublabel?: string;
  status?: ChangeOrderStatus;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="wrap-anywhere">{label}</span>
        {sublabel ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {sublabel}
          </span>
        ) : null}
        {status ? (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[0.7rem] font-medium capitalize ${STATUS_STYLES[status]}`}
          >
            {status}
          </span>
        ) : null}
      </dt>
      <dd
        className={`shrink-0 tabular-nums ${muted ? "text-muted-foreground line-through" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
