import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/money";
import { PASS_PRICE_CENTS, PASS_INCLUDES } from "@/lib/pricing";
import type { Project } from "@/lib/projects";

/**
 * Shown when the homeowner wants to add a second change order to a project
 * they haven't paid for. The "worth it" line is computed from their own first
 * report, not written in advance.
 */
export function PaywallCard({ project }: { project: Project }) {
  const firstAtStake = project.changeOrders[0]?.atStakeCents ?? 0;

  const worthIt =
    firstAtStake > 0
      ? `Your first change order had ${formatUsd(firstAtStake)} at stake. The pass costs ${formatUsd(PASS_PRICE_CENTS)}.`
      : "One avoided double charge usually costs more than the pass.";

  return (
    <Card className="border-2 border-primary/30">
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Unlock this project to add more change orders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatUsd(PASS_PRICE_CENTS)} one-time for this project.
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          {PASS_INCLUDES.map((item) => (
            <li key={item} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="wrap-anywhere">{item}</span>
            </li>
          ))}
        </ul>

        <p className="rounded-lg bg-muted/60 p-3 text-sm wrap-anywhere">{worthIt}</p>

        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href={`/checkout/${project.id}`}>Unlock Project Pass</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
