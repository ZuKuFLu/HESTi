"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, Info, Lock, Sparkles } from "lucide-react";
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
        <Button asChild className="h-10 px-4">
          <Link href="/">Back to HESTi</Link>
        </Button>
      </div>
    );
  }

  const project = state.project;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div
        role="note"
        className="flex items-start gap-2.5 rounded-xl bg-info-bg p-4 text-sm text-info ring-1 ring-info-line/25"
      >
        <Info className="mt-0.5 size-4.5 shrink-0" />
        <p>
          <span className="font-semibold">Demo checkout:</span> no real payment
          is taken.
        </p>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground wrap-anywhere">
          For the project &ldquo;{project.name}&rdquo;
        </p>
      </div>

      <Card className="ring-foreground/10">
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3 border-b border-border/70 pb-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium wrap-anywhere">{PASS_NAME}</p>
              <p className="text-sm text-muted-foreground">
                One-time payment for this project
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">
              {formatUsd(PASS_PRICE_CENTS)}
            </p>
          </div>

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

          <dl className="space-y-2 border-t border-border/70 pt-5 text-sm">
            <div className="flex items-baseline justify-between gap-4 text-muted-foreground">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatUsd(PASS_PRICE_CENTS)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 text-muted-foreground">
              <dt>Tax</dt>
              <dd className="tabular-nums">{formatUsd(0)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 pt-2 text-lg font-semibold">
              <dt>Total due today</dt>
              <dd className="tabular-nums">{formatUsd(PASS_PRICE_CENTS)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          onClick={completePurchase}
          disabled={working}
          className="h-11 gap-2 px-5 text-base sm:flex-1"
        >
          <Lock className="size-4" />
          {working ? "Completing…" : "Complete purchase"}
        </Button>
        <Button asChild variant="outline" className="h-11 px-5 text-base">
          <Link href={`/p/${id}`}>Back to project</Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        No card details are collected and no money changes hands. Completing
        this unlocks the pass for this project in this browser.
      </p>
    </div>
  );
}
