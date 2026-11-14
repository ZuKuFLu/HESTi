"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  MessageSquareQuote,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd, toCentsOrZero } from "@/lib/money";
import type { Extraction, Flag, LineItem, Severity } from "@/lib/schemas";

const SEVERITY: Record<
  Severity,
  { badge: string; rail: string; label: string; icon: typeof AlertTriangle }
> = {
  high: {
    badge: "bg-high-bg text-high",
    rail: "border-l-high-line",
    label: "High",
    icon: AlertTriangle,
  },
  medium: {
    badge: "bg-medium-bg text-medium",
    rail: "border-l-medium-line",
    label: "Medium",
    icon: AlertTriangle,
  },
  info: {
    badge: "bg-info-bg text-info",
    rail: "border-l-info-line",
    label: "Info",
    icon: Info,
  },
};

export function FlagCard({
  flag,
  quote,
  changeOrder,
}: {
  flag: Flag;
  quote: Extraction;
  changeOrder: Extraction;
}) {
  const styles = SEVERITY[flag.severity];
  const Icon = styles.icon;
  const coEvidence = resolve(changeOrder.line_items, flag.coLineIds);
  const quoteEvidence = resolve(quote.line_items, flag.quoteLineIds);
  const hasEvidence = coEvidence.length > 0 || quoteEvidence.length > 0;

  return (
    <Card className={`border-l-4 ${styles.rail} rounded-l-md`}>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span
              className={`mt-0.5 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles.badge}`}
            >
              <Icon className="size-3" />
              {styles.label}
            </span>
            <h3 className="min-w-0 text-base leading-snug font-semibold wrap-anywhere">
              {flag.title}
            </h3>
          </div>
          {flag.amountCents > 0 ? (
            <span className="shrink-0 text-lg font-semibold tabular-nums">
              {formatUsd(flag.amountCents)}
            </span>
          ) : null}
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground wrap-anywhere">
          {flag.explanation}
        </p>

        {hasEvidence ? (
          <div className="rounded-lg bg-muted/70 p-3 ring-1 ring-foreground/5 ring-inset">
            <p className="mb-2 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
              Evidence
            </p>
            <ul className="space-y-2 text-sm">
              {coEvidence.map((line) => (
                <EvidenceRow
                  key={`co-${line.id}`}
                  source="Change order"
                  line={line}
                />
              ))}
              {quoteEvidence.map((line) => (
                <EvidenceRow
                  key={`q-${line.id}`}
                  source="Original quote"
                  line={line}
                />
              ))}
            </ul>
          </div>
        ) : null}

        <AskBlock question={flag.question} />
      </CardContent>
    </Card>
  );
}

/** The sentence the homeowner actually sends, so it is built to be copied. */
function AskBlock({ question }: { question: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const textRef = useRef<HTMLParagraphElement>(null);

  async function copy() {
    const ok = await writeToClipboard(question);
    if (ok) {
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
      return;
    }
    // Some browsers refuse clipboard writes outright. Select the text so
    // Ctrl+C still works rather than leaving a button that does nothing.
    selectText(textRef.current);
    setState("manual");
    window.setTimeout(() => setState("idle"), 4000);
  }

  return (
    <div className="rounded-lg border-l-2 border-primary/50 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wide text-primary uppercase">
          <MessageSquareQuote className="size-3.5" />
          Ask your contractor
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy this question"
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {state === "copied" ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {state === "copied"
            ? "Copied"
            : state === "manual"
              ? "Press Ctrl+C"
              : "Copy"}
        </button>
      </div>
      <p ref={textRef} className="mt-1.5 text-sm leading-relaxed wrap-anywhere">
        {question}
      </p>
    </div>
  );
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

function selectText(element: HTMLElement | null) {
  if (!element) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function EvidenceRow({ source, line }: { source: string; line: LineItem }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-[0.7rem] text-muted-foreground ring-1 ring-foreground/5">
        {source}
      </span>
      <span className="min-w-0 flex-1 basis-40 wrap-anywhere">
        {line.description}
      </span>
      {line.total !== null ? (
        <span className="shrink-0 font-medium tabular-nums">
          {formatUsd(toCentsOrZero(line.total))}
        </span>
      ) : null}
    </li>
  );
}

function resolve(lines: LineItem[], ids: string[]): LineItem[] {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  return lines.filter((line) => wanted.has(line.id));
}
