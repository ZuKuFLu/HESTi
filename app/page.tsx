"use client";

import { useRef, useState } from "react";
import { UploadPanel, type AnalysisPayload } from "@/components/UploadPanel";
import { ReportView } from "@/components/ReportView";

const STEPS = [
  {
    title: "Upload both documents",
    body: "Your original quote and the change order — a PDF, a photo, or pasted text.",
  },
  {
    title: "We compare them line by line",
    body: "One AI pass reads both documents; the math and the totals are checked in code.",
  },
  {
    title: "You get questions to ask",
    body: "Every problem comes with the evidence behind it and a question for your contractor.",
  },
];

const SAMPLES = [
  { file: "quote-bathroom.pdf", label: "Sample quote (PDF)" },
  { file: "change-order-1.pdf", label: "Sample change order (PDF)" },
];

export default function Home() {
  const [payload, setPayload] = useState<AnalysisPayload | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  function handleResult(next: AnalysisPayload) {
    setPayload(next);
    requestAnimationFrame(() => {
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1100px] items-center px-5 py-4">
          <span className="text-lg font-semibold tracking-tight">HESTi</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-12">
        <section className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Understand your contractor&apos;s change order
          </h1>
          <p className="mt-4 text-muted-foreground">
            Your bathroom was quoted at $8,000. Halfway through, a change order arrives for
            $2,500. HESTi compares it with your original quote, checks the math, and tells
            you exactly what to ask.
          </p>
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="rounded-lg border p-4">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <UploadPanel onResult={handleResult} />
          <p className="mt-3 text-xs text-muted-foreground">
            Want to look at the sample documents first?{" "}
            {SAMPLES.map((sample, index) => (
              <span key={sample.file}>
                <a
                  href={`/samples/${sample.file}`}
                  download
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {sample.label}
                </a>
                {index < SAMPLES.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </section>

        <div ref={reportRef} className="scroll-mt-6">
          {payload ? (
            <section className="mt-12 space-y-5">
              <div>
                <p className="text-sm text-muted-foreground">Report</p>
                <h2 className="text-2xl font-semibold tracking-tight wrap-anywhere">
                  {payload.projectName}
                </h2>
              </div>
              <ReportView result={payload.result} />
            </section>
          ) : null}
        </div>
      </main>

      <footer className="mt-16 border-t">
        <div className="mx-auto max-w-[1100px] px-5 py-6 text-xs text-muted-foreground">
          Not legal, financial or construction advice. Flags are questions to ask, not
          accusations.
        </div>
      </footer>
    </div>
  );
}
