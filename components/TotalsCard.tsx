import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatUsd } from "@/lib/money";
import { computeTotals, type Project } from "@/lib/projects";

export function TotalsCard({ project }: { project: Project }) {
  const totals = computeTotals(project);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Where this project stands</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
              {formatUsd(totals.currentCents)}
            </p>
          </div>
          {totals.originalCents > 0 ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {totals.percentOver}
              </span>{" "}
              over the original quote
            </p>
          ) : null}
        </div>

        <dl className="divide-y border-t text-sm">
          <Row label="Original quote" value={formatUsd(totals.originalCents)} />
          {project.changeOrders.map((order, index) => (
            <Row
              key={order.id}
              label={`Change order ${index + 1}`}
              sublabel={formatDate(order.extraction.document_date) ?? undefined}
              value={formatUsd(totals.changeOrderCents[index])}
            />
          ))}
          <div className="flex items-baseline justify-between gap-4 pt-3 font-semibold">
            <dt>Current total</dt>
            <dd className="tabular-nums">{formatUsd(totals.currentCents)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  sublabel,
  value,
}: {
  label: string;
  sublabel?: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="min-w-0">
        <span className="wrap-anywhere">{label}</span>
        {sublabel ? (
          <span className="ml-2 text-xs text-muted-foreground">{sublabel}</span>
        ) : null}
      </dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}
