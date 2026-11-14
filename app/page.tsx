"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  FileSearch,
  MessageSquareQuote,
  Sparkles,
  Trash2,
  Upload,
  UserRoundCheck,
} from "lucide-react";
import { HeroPreview } from "@/components/HeroPreview";
import { PricingSection } from "@/components/PricingSection";
import { ProjectsList } from "@/components/ProjectsList";
import {
  UploadPanel,
  type AnalysisPayload,
  type UploadPanelHandle,
} from "@/components/UploadPanel";
import { Button } from "@/components/ui/button";
import { createProject } from "@/lib/projects";

const STEPS = [
  {
    icon: Upload,
    title: "Upload both documents",
    body: "Your original quote and the change order — a PDF, a photo, or pasted text.",
  },
  {
    icon: FileSearch,
    title: "We compare them line by line",
    body: "One AI pass reads both documents; the math and the totals are checked in code.",
  },
  {
    icon: MessageSquareQuote,
    title: "You get questions to ask",
    body: "Every finding comes with the evidence behind it and a question for your contractor.",
  },
];

const TRUST = [
  { icon: UserRoundCheck, label: "No sign-up" },
  { icon: Clock, label: "Results in about 30 seconds" },
  { icon: Trash2, label: "Your files aren't stored" },
];

const SAMPLES = [
  { file: "quote-bathroom.pdf", label: "Sample quote (PDF)" },
  { file: "change-order-1.pdf", label: "Sample change order (PDF)" },
];

export default function Home() {
  const router = useRouter();
  const panelRef = useRef<UploadPanelHandle>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  function scrollToUpload() {
    uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function startSample() {
    scrollToUpload();
    panelRef.current?.runSample();
  }

  function handleResult(payload: AnalysisPayload) {
    const project = createProject(
      payload.projectName,
      payload.result,
      payload.changeOrderFileName,
    );
    router.push(`/p/${project.id}`);
  }

  return (
    <div className="space-y-20">
      <section className="hearth-glow -mx-5 -mt-12 rounded-b-[2rem] px-5 pt-14 pb-12">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl">
              Your contractor sent a change order.{" "}
              <span className="text-primary">
                Know what you&apos;re paying for.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              HESTi reads it next to your original quote, checks every number,
              and hands you the questions worth asking — before you sign.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button onClick={scrollToUpload} className="h-11 px-6 text-base">
                Check my change order
              </Button>
              <Button
                onClick={startSample}
                variant="outline"
                className="h-11 gap-2 px-6 text-base"
              >
                <Sparkles className="size-4" />
                Try a sample
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5">
              {TRUST.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <item.icon className="size-4 text-primary" />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <HeroPreview />
        </div>
      </section>

      <section ref={uploadRef} className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Start with your two documents
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing to sign up for. Your first report is free.
          </p>
        </div>
        <UploadPanel ref={panelRef} onResult={handleResult} />
        <p className="text-xs text-muted-foreground">
          Want to look at the sample documents first?{" "}
          {SAMPLES.map((sample, index) => (
            <span key={sample.file}>
              <a
                href={`/samples/${sample.file}`}
                download
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {sample.label}
              </a>
              {index < SAMPLES.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <step.icon className="size-5" />
              </span>
              <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground tabular-nums">
                STEP {index + 1}
              </p>
              <p className="mt-1 font-semibold">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <ProjectsList />

      <PricingSection />
    </div>
  );
}
