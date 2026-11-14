"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/money";
import { PASS_INCLUDES, PASS_NAME, PASS_PRICE_CENTS } from "@/lib/pricing";
import { getProject, markPaid, type Project } from "@/lib/projects";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; project: Project };

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const project = getProject(id);
    setState(project ? { status: "ready", project } : { status: "missing" });
  }, [id]);

  function completePurchase() {
    setWorking(true);
    const updated = markPaid(id);
    if (!updated) {
      setWorking(false);
      setState({ status: "missing" });
      return;
    }
    router.push(`/p/${id}?paid=1`);
  }

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (state.status === "missing") {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn&apos;t find that project
        </h1>
        <p className="text-sm text-muted-foreground">
          Projects are saved in the browser you created them in.
        </p>
        <Button asChild>
          <Link href="/">Back to HESTi</Link>
        </Button>
      </div>
    );
  }

  const project = state.project;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div
        role="note"
        className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"
      >
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>Demo checkout: no real payment is taken.</p>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground wrap-anywhere">
          For the project &ldquo;{project.name}&rdquo;
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between gap-4 border-b pb-4">
            <div className="min-w-0">
              <p className="font-medium wrap-anywhere">{PASS_NAME}</p>
              <p className="text-sm text-muted-foreground">
                One-time payment for this project
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">
              {formatUsd(PASS_PRICE_CENTS)}
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

          <div className="flex items-baseline justify-between gap-4 border-t pt-4 text-base font-semibold">
            <span>Total due today</span>
            <span className="tabular-nums">{formatUsd(PASS_PRICE_CENTS)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={completePurchase} disabled={working} className="sm:flex-1">
          {working ? "Completing…" : "Complete purchase"}
        </Button>
        <Button asChild size="lg" variant="outline" disabled={working}>
          <Link href={`/p/${id}`}>Back to project</Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        No card details are collected and no money changes hands. Completing this unlocks
        the pass for this project in this browser.
      </p>
    </div>
  );
}
