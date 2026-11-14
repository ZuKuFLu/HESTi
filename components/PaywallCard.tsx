import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/money";
import { PASS_INCLUDES, PASS_PRICE_CENTS } from "@/lib/pricing";
import type { Project } from "@/lib/projects";

/**
 * Shown when the homeowner wants to add a second change order to a project
 * they haven't paid for. The "worth it" comparison is computed from their own
 * first report, not written in advance.
 */
export function PaywallCard({ project }: { project: Project }) {
  const firstAtStake = project.changeOrders[0]?.atStakeCents ?? 0;

  return (
    <Card className="overflow-hidden ring-2 ring-primary">
      <CardContent className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Unlock this project to add more change orders
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {formatUsd(PASS_PRICE_CENTS)}
              </span>{" "}
              one-time for this project.
            </p>
          </div>
        </div>

        {firstAtStake > 0 ? (
          <div className="flex items-stretch gap-3 rounded-xl bg-muted/70 p-4 ring-1 ring-foreground/5 ring-inset">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                At stake on your first change order
              </p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight text-high tabular-nums">
                {formatUsd(firstAtStake)}
              </p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">The pass costs</p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
                {formatUsd(PASS_PRICE_CENTS)}
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-muted/70 p-4 text-sm ring-1 ring-foreground/5 ring-inset">
            One avoided double charge usually costs more than the pass.
          </p>
        )}

        <ul className="space-y-2.5 text-sm">
          {PASS_INCLUDES.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3" />
              </span>
              <span className="wrap-anywhere">{item}</span>
            </li>
          ))}
        </ul>

        <Button asChild className="h-11 w-full gap-2 px-5 text-base sm:w-auto">
          <Link href={`/checkout/${project.id}`}>
            Unlock Project Pass
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
