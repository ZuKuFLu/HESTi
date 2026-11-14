import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/money";
import { HOME_PLAN_PRICE_CENTS, PASS_INCLUDES, PASS_PRICE_CENTS } from "@/lib/pricing";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    note: "No sign-up, no card",
    features: ["Your original quote and first change order", "The full report"],
    highlight: false,
  },
  {
    name: "Project Pass",
    price: formatUsd(PASS_PRICE_CENTS),
    note: "One-time, per project",
    features: [...PASS_INCLUDES],
    highlight: true,
  },
  {
    name: "Home Plan",
    price: `${formatUsd(HOME_PLAN_PRICE_CENTS)}/yr`,
    note: "Every project on your home",
    features: ["Coming soon"],
    highlight: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your first report is free. You only pay when a project keeps producing change
          orders.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <Card key={tier.name} className={tier.highlight ? "border-2 border-primary" : ""}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{tier.name}</p>
                {tier.name === "Home Plan" ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Coming soon
                  </span>
                ) : null}
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">{tier.price}</p>
                <p className="text-xs text-muted-foreground">{tier.note}</p>
              </div>
              <ul className="space-y-1.5 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="wrap-anywhere">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Checkout is a demo: no real payment is taken and no card details are collected.
      </p>
    </section>
  );
}
