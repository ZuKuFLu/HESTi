import { Check, House, Receipt, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/money";
import {
  HOME_PLAN_PRICE_CENTS,
  PASS_INCLUDES,
  PASS_PRICE_CENTS,
} from "@/lib/pricing";

const TIERS = [
  {
    name: "Free",
    icon: Receipt,
    price: "$0",
    note: "No sign-up, no card",
    features: ["Your original quote and first change order", "The full report"],
    highlight: false,
    comingSoon: false,
  },
  {
    name: "Project Pass",
    icon: Sparkles,
    price: formatUsd(PASS_PRICE_CENTS),
    note: "One-time, per project",
    features: [...PASS_INCLUDES],
    highlight: true,
    comingSoon: false,
  },
  {
    name: "Home Plan",
    icon: House,
    price: `${formatUsd(HOME_PLAN_PRICE_CENTS)}/yr`,
    note: "Every project on your home",
    features: ["Coming soon"],
    highlight: false,
    comingSoon: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your first report is free. You only pay when a project keeps producing
          change orders.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <Card
            key={tier.name}
            className={
              tier.highlight
                ? "bg-card ring-2 ring-primary"
                : tier.comingSoon
                  ? "bg-card/50"
                  : "bg-card"
            }
          >
            <CardContent className="flex h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`flex size-9 items-center justify-center rounded-xl ${
                    tier.highlight
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <tier.icon className="size-4.5" />
                </span>
                {tier.comingSoon ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Coming soon
                  </span>
                ) : null}
              </div>

              <div>
                <p className="font-semibold">{tier.name}</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                  {tier.price}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {tier.note}
                </p>
              </div>

              <ul className="space-y-2 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check
                      className={`mt-0.5 size-4 shrink-0 ${
                        tier.highlight
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                    <span className="wrap-anywhere">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Checkout is a demo: no real payment is taken and no card details are
        collected.
      </p>
    </section>
  );
}
