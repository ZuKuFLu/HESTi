import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/money";
import type { Flag, Severity } from "@/lib/schemas";

const PILLS: { key: Severity; label: string; className: string }[] = [
  { key: "high", label: "high", className: "bg-high-bg text-high" },
  { key: "medium", label: "medium", className: "bg-medium-bg text-medium" },
  { key: "info", label: "info", className: "bg-info-bg text-info" },
];

/**
 * The headline of every report, and the same component the home page uses for
 * its example preview — so what people see before uploading is what they get.
 */
export function AtStakeCard({
  atStakeCents,
  flags,
  compact = false,
}: {
  atStakeCents: number;
  flags: Flag[];
  compact?: boolean;
}) {
  return (
    <Card className="overflow-hidden ring-foreground/10">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Worth asking about
            </p>
            <p
              className={`mt-1 font-semibold tracking-tight tabular-nums ${
                compact ? "text-3xl" : "text-4xl sm:text-5xl"
              }`}
            >
              {formatUsd(atStakeCents)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              across {flags.length}{" "}
              {flags.length === 1 ? "finding" : "findings"} on this change order
            </p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PILLS.map((pill) => {
            const count = flags.filter(
              (flag) => flag.severity === pill.key,
            ).length;
            return (
              <span
                key={pill.key}
                className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${
                  count > 0 ? pill.className : "bg-muted text-muted-foreground"
                }`}
              >
                {count} {pill.label}
              </span>
            );
          })}
        </div>

        {compact ? null : (
          <p className="border-t border-border/70 pt-3 text-xs text-muted-foreground">
            Not legal, financial or construction advice. Flags are questions to
            ask, not accusations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
