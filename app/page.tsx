"use client";

import { useRouter } from "next/navigation";
import { PricingSection } from "@/components/PricingSection";
import { ProjectsList } from "@/components/ProjectsList";
import { UploadPanel, type AnalysisPayload } from "@/components/UploadPanel";
import { createProject } from "@/lib/projects";

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
  const router = useRouter();

  function handleResult(payload: AnalysisPayload) {
    const project = createProject(
      payload.projectName,
      payload.result,
      payload.changeOrderFileName,
    );
    router.push(`/p/${project.id}`);
  }

  return (
    <div className="space-y-16">
      <section className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Understand your contractor&apos;s change order
        </h1>
        <p className="mt-4 text-muted-foreground">
          Your bathroom was quoted at $8,000. Halfway through, a change order arrives for
          $2,500. You can&apos;t tell what actually changed, whether you&apos;re paying
          twice for the same work, or why the date moved. HESTi reads both documents and
          tells you what to ask.
        </p>
      </section>

      <section className="grid gap-5 sm:grid-cols-3">
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

      <section>
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

      <ProjectsList />

      <PricingSection />
    </div>
  );
}
