"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  House,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { PaywallCard } from "@/components/PaywallCard";
import { ReportView } from "@/components/ReportView";
import { TotalsCard } from "@/components/TotalsCard";
import { UploadPanel, type AnalysisPayload } from "@/components/UploadPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatUsd } from "@/lib/money";
import {
  MAX_CHANGE_ORDERS,
  addChangeOrder,
  getProject,
  isPersistent,
  type Project,
} from "@/lib/projects";
import type { AnalysisResult } from "@/lib/schemas";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; project: Project };

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [persistent, setPersistent] = useState(true);
  const [justPaid, setJustPaid] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [limitHit, setLimitHit] = useState(false);

  // localStorage only exists in the browser, so the first render is always a
  // loading state rather than an attempt to read it.
  useEffect(() => {
    const project = getProject(id);
    setState(project ? { status: "ready", project } : { status: "missing" });
    setPersistent(isPersistent());

    // Read the checkout's success flag once, then drop it from the URL so the
    // banner doesn't reappear every time this page is reloaded or shared.
    if (new URLSearchParams(window.location.search).get("paid") === "1") {
      setJustPaid(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [id]);

  const project = state.status === "ready" ? state.project : null;
  const quoteJson = useMemo(
    () => (project ? JSON.stringify(project.quote) : ""),
    [project],
  );

  function handleResult(payload: AnalysisPayload) {
    const outcome = addChangeOrder(
      id,
      payload.result,
      payload.changeOrderFileName,
    );
    if (!outcome.ok) {
      if (outcome.reason === "limit_reached") setLimitHit(true);
      return;
    }
    setState({ status: "ready", project: outcome.project });
    setPersistent(isPersistent());
    setAdding(false);
  }

  if (state.status === "loading") {
    return (
      <p className="text-sm text-muted-foreground">Loading your project…</p>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="max-w-xl space-y-4">
        <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <House className="size-5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn&apos;t find that project
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Projects are saved in the browser you created them in. If you opened
          this link on another device, or cleared your site data, it won&apos;t
          be here.
        </p>
        <Button asChild className="h-10 px-4">
          <Link href="/">Start a new project</Link>
        </Button>
      </div>
    );
  }

  const ready = state.project;
  const atLimit = ready.changeOrders.length >= MAX_CHANGE_ORDERS;

  return (
    <div className="space-y-8">
      <section className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <House className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Project
          </p>
          <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere sm:text-3xl">
            {ready.name}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span>Started {formatDate(ready.createdAt.slice(0, 10))}</span>
            {ready.paid ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Project Pass
              </span>
            ) : null}
          </p>
        </div>
      </section>

      {justPaid ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl bg-primary/8 p-4 text-sm ring-1 ring-primary/25"
        >
          <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-primary" />
          <p>
            <span className="font-medium">Project Pass unlocked.</span> You can
            add as many change orders to this project as you need.
          </p>
        </div>
      ) : null}

      {persistent ? null : (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl bg-medium-bg p-4 text-sm text-medium ring-1 ring-medium-line/30"
        >
          <TriangleAlert className="mt-0.5 size-4.5 shrink-0" />
          <p>
            Your browser isn&apos;t letting us save projects, so this one will
            disappear when you close the tab.
          </p>
        </div>
      )}

      <TotalsCard project={ready} />

      <ol className="space-y-8">
        {ready.changeOrders.map((order, index) => (
          <li key={order.id} className="relative pl-9 sm:pl-11">
            {/* Timeline rail: a dot per change order, joined down the page. */}
            <span
              aria-hidden
              className="absolute top-9 bottom-0 left-[13px] w-px bg-border sm:left-[17px]"
            />
            <span className="absolute top-0.5 left-0 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums sm:size-9 sm:text-sm">
              {index + 1}
            </span>

            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Change order {index + 1}
                </h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    <span className="wrap-anywhere">
                      {order.fileName ?? "Pasted text"}
                    </span>
                  </span>
                  {order.extraction.document_date ? (
                    <span className="tabular-nums">
                      · {formatDate(order.extraction.document_date)}
                    </span>
                  ) : null}
                  {order.extraction.total !== null ? (
                    <span className="tabular-nums">
                      · {formatUsd(Math.round(order.extraction.total * 100))}
                    </span>
                  ) : null}
                </p>
              </div>

              <ReportView
                result={
                  {
                    quote: ready.quote,
                    changeOrder: order.extraction,
                    matches: order.matches,
                    flags: order.flags,
                    atStakeCents: order.atStakeCents,
                    prepared: order.prepared,
                  } satisfies AnalysisResult
                }
              />
            </div>
          </li>
        ))}
      </ol>

      <section className="space-y-4">
        {atLimit || limitHit ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This project has the maximum of {MAX_CHANGE_ORDERS} change
                orders. Start a new project to keep going.
              </p>
            </CardContent>
          </Card>
        ) : adding ? (
          <>
            <h2 className="text-xl font-semibold tracking-tight">
              Add another change order
            </h2>
            <UploadPanel onResult={handleResult} quoteJson={quoteJson} />
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </>
        ) : showPaywall && !ready.paid ? (
          <PaywallCard project={ready} />
        ) : (
          <Button
            variant="outline"
            className="h-11 gap-2 px-5 text-base"
            onClick={() =>
              ready.paid ? setAdding(true) : setShowPaywall(true)
            }
          >
            <Plus className="size-4" />
            Add another change order
          </Button>
        )}
      </section>
    </div>
  );
}
