"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { PaywallCard } from "@/components/PaywallCard";
import { ReportView } from "@/components/ReportView";
import { TotalsCard } from "@/components/TotalsCard";
import { UploadPanel, type AnalysisPayload } from "@/components/UploadPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/money";
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
    const outcome = addChangeOrder(id, payload.result, payload.changeOrderFileName);
    if (!outcome.ok) {
      if (outcome.reason === "limit_reached") setLimitHit(true);
      return;
    }
    setState({ status: "ready", project: outcome.project });
    setPersistent(isPersistent());
    setAdding(false);
  }

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading your project…</p>;
  }

  if (state.status === "missing") {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn&apos;t find that project
        </h1>
        <p className="text-sm text-muted-foreground">
          Projects are saved in the browser you created them in. If you opened this link
          on another device, or cleared your site data, it won&apos;t be here.
        </p>
        <Button asChild>
          <Link href="/">Start a new project</Link>
        </Button>
      </div>
    );
  }

  const ready = state.project;
  const atLimit = ready.changeOrders.length >= MAX_CHANGE_ORDERS;

  return (
    <div className="space-y-10">
      <section className="space-y-1">
        <p className="text-sm text-muted-foreground">Project</p>
        <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere sm:text-3xl">
          {ready.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Started {formatDate(ready.createdAt.slice(0, 10))}
          {ready.paid ? " · Project Pass unlocked" : ""}
        </p>
      </section>

      {justPaid ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <p>
            Project Pass unlocked. You can add as many change orders to this project as
            you need.
          </p>
        </div>
      ) : null}

      {persistent ? null : (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Your browser isn&apos;t letting us save projects, so this one will disappear when
          you close the tab.
        </div>
      )}

      <TotalsCard project={ready} />

      {ready.changeOrders.map((order, index) => (
        <section key={order.id} className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Change order {index + 1}
            </h2>
            <p className="text-sm text-muted-foreground">
              {order.fileName ?? "Pasted text"}
              {order.extraction.document_date
                ? ` · ${formatDate(order.extraction.document_date)}`
                : ""}
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
              } satisfies AnalysisResult
            }
          />
        </section>
      ))}

      <section className="space-y-4">
        {atLimit || limitHit ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This project has the maximum of {MAX_CHANGE_ORDERS} change orders. Start a
                new project to keep going.
              </p>
            </CardContent>
          </Card>
        ) : adding ? (
          <>
            <h2 className="text-xl font-semibold tracking-tight">Add another change order</h2>
            <UploadPanel onResult={handleResult} quoteJson={quoteJson} />
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </>
        ) : showPaywall && !ready.paid ? (
          <PaywallCard project={ready} />
        ) : (
          <Button
            size="lg"
            variant="outline"
            onClick={() => (ready.paid ? setAdding(true) : setShowPaywall(true))}
          >
            Add another change order
          </Button>
        )}
      </section>
    </div>
  );
}
