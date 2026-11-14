"use client";

import { useImperativeHandle, useRef, useState } from "react";
import {
  Check,
  FileText,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_FILE_TYPES, isAcceptedFile, prepareFileForUpload } from "@/lib/image";
import type { AnalysisResult } from "@/lib/schemas";

const DEFAULT_PROJECT_NAME = "My renovation";
const SAMPLE_PROJECT_NAME = "Sample: Maya's bathroom remodel";
const MAX_TEXT_CHARS = 20_000;

const PROGRESS_STEPS = [
  "Reading your documents",
  "Comparing with your quote",
  "Checking the math",
] as const;

export type AnalysisPayload = {
  result: AnalysisResult;
  projectName: string;
  changeOrderFileName: string | null;
};

/** Lets the hero's "Try a sample" button drive the panel below it. */
export type UploadPanelHandle = { runSample: () => void };

type SlotState = { mode: "file" | "text"; file: File | null; text: string };

const emptySlot = (): SlotState => ({ mode: "file", file: null, text: "" });

export function UploadPanel({
  onResult,
  quoteJson,
  ref,
}: {
  onResult: (payload: AnalysisPayload) => void;
  quoteJson?: string;
  ref?: React.Ref<UploadPanelHandle>;
}) {
  const changeOrderOnly = quoteJson !== undefined;
  const [quote, setQuote] = useState<SlotState>(emptySlot);
  const [changeOrder, setChangeOrder] = useState<SlotState>(emptySlot);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<null | "form" | "sample">(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useImperativeHandle(ref, () => ({ runSample: () => void submitSample() }));

  function startProgress() {
    setStep(0);
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => setStep(1), 1800),
      setTimeout(() => setStep(2), 4500),
    ];
  }

  function stopProgress() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  async function send(form: FormData, name: string, coFileName: string | null) {
    setBusy(true);
    setError(null);
    startProgress();

    try {
      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          (body && typeof body.message === "string" && body.message) ||
            "Something went wrong. Please try again.",
        );
        return;
      }

      onResult({
        result: body as AnalysisResult,
        projectName: name,
        changeOrderFileName: coFileName,
      });
    } catch {
      setError(
        "We couldn't reach the server. Please check your connection and try again.",
      );
    } finally {
      stopProgress();
      setBusy(false);
    }
  }

  async function submitForm() {
    const quoteReady = quote.mode === "file" ? quote.file : quote.text.trim();
    const coReady =
      changeOrder.mode === "file" ? changeOrder.file : changeOrder.text.trim();

    if (!changeOrderOnly && !quoteReady) {
      setError("Please add your original quote.");
      return;
    }
    if (!coReady) {
      setError("Please add the change order.");
      return;
    }

    setLastRun("form");
    const form = new FormData();

    if (changeOrderOnly) {
      form.set("quoteJson", quoteJson);
    } else if (quote.mode === "file" && quote.file) {
      form.set("quoteFile", await prepareFileForUpload(quote.file));
    } else {
      form.set("quoteText", quote.text.trim());
    }

    let coFileName: string | null = null;
    if (changeOrder.mode === "file" && changeOrder.file) {
      const prepared = await prepareFileForUpload(changeOrder.file);
      coFileName = prepared.name;
      form.set("coFile", prepared);
    } else {
      form.set("coText", changeOrder.text.trim());
    }

    await send(form, projectName.trim() || DEFAULT_PROJECT_NAME, coFileName);
  }

  /**
   * The sample goes through exactly the same endpoint as a user upload: the
   * two PDFs are fetched in the browser and posted as files.
   */
  async function submitSample() {
    setLastRun("sample");
    setBusy(true);
    setError(null);
    startProgress();

    try {
      const [quoteFile, coFile] = await Promise.all([
        fetchSample("quote-bathroom.pdf"),
        fetchSample("change-order-1.pdf"),
      ]);

      const form = new FormData();
      form.set("quoteFile", quoteFile);
      form.set("coFile", coFile);

      stopProgress();
      setBusy(false);
      await send(form, SAMPLE_PROJECT_NAME, coFile.name);
    } catch {
      stopProgress();
      setBusy(false);
      setError("We couldn't load the sample documents. Please try again.");
    }
  }

  function retry() {
    if (lastRun === "sample") void submitSample();
    else void submitForm();
  }

  return (
    <Card className="shadow-[0_1px_2px_rgba(28,36,52,0.04),0_12px_32px_-12px_rgba(28,36,52,0.12)] ring-foreground/10">
      <CardContent className="space-y-6 py-2">
        <div className={changeOrderOnly ? "" : "grid gap-4 sm:grid-cols-2"}>
          {changeOrderOnly ? null : (
            <DocumentSlot
              label="Original quote"
              hint="The estimate you agreed to"
              state={quote}
              onChange={setQuote}
              disabled={busy}
              idPrefix="quote"
            />
          )}
          <DocumentSlot
            label={changeOrderOnly ? "New change order" : "Change order"}
            hint={
              changeOrderOnly
                ? "We'll compare it with the quote already on this project"
                : "The new document asking for more"
            }
            state={changeOrder}
            onChange={setChangeOrder}
            disabled={busy}
            idPrefix="co"
          />
        </div>

        {changeOrderOnly ? null : (
          <div className="space-y-1.5">
            <label htmlFor="project-name" className="text-sm font-medium">
              Project name{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder={DEFAULT_PROJECT_NAME}
              disabled={busy}
              maxLength={80}
            />
          </div>
        )}

        {busy ? <AnalyzingSteps step={step} /> : null}

        {error && !busy ? (
          <div
            role="alert"
            className="space-y-3 rounded-xl bg-high-bg p-4 text-sm text-high ring-1 ring-high-line/25"
          >
            <p>{error}</p>
            {lastRun ? (
              <Button size="sm" variant="outline" onClick={retry}>
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={submitForm}
            disabled={busy}
            className="h-11 px-5 text-base sm:flex-1"
          >
            {busy
              ? "Checking…"
              : changeOrderOnly
                ? "Check this change order"
                : "Check my change order"}
          </Button>
          {changeOrderOnly ? null : (
            <Button
              onClick={submitSample}
              disabled={busy}
              variant="outline"
              className="h-11 gap-2 px-5 text-base"
            >
              <Sparkles className="size-4" />
              Try a sample
            </Button>
          )}
        </div>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          <span>
            Demo build on a free AI tier: please don&apos;t upload documents with
            sensitive personal information.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

/** Progress the homeowner can read: done, doing, still to come. */
function AnalyzingSteps({ step }: { step: number }) {
  return (
    <ul className="space-y-2.5 rounded-xl bg-muted/70 p-4 ring-1 ring-foreground/5 ring-inset">
      {PROGRESS_STEPS.map((label, index) => {
        const done = index < step;
        const active = index === step;
        return (
          <li
            key={label}
            className={`flex items-center gap-2.5 text-sm transition-colors ${
              done || active ? "text-foreground" : "text-muted-foreground/60"
            }`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-primary/15 text-primary"
                    : "bg-foreground/5"
              }`}
            >
              {done ? (
                <Check className="size-3 animate-in zoom-in-50 duration-200" />
              ) : active ? (
                <Loader2 className="size-3 animate-spin" />
              ) : null}
            </span>
            <span className={active ? "font-medium" : ""}>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

function DocumentSlot({
  label,
  hint,
  state,
  onChange,
  disabled,
  idPrefix,
}: {
  label: string;
  hint: string;
  state: SlotState;
  onChange: (next: SlotState) => void;
  disabled: boolean;
  idPrefix: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function pickFile(file: File | null) {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      setFileError("Please choose a PDF, JPG, PNG or WebP file.");
      return;
    }
    setFileError(null);
    onChange({ ...state, file });
  }

  const isImage = state.file?.type.startsWith("image/") ?? false;

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      <Tabs
        value={state.mode}
        onValueChange={(value) => onChange({ ...state, mode: value as SlotState["mode"] })}
      >
        <TabsList className="w-full">
          <TabsTrigger value="file" disabled={disabled} className="flex-1 gap-1.5">
            <Upload className="size-3.5" />
            PDF or photo
          </TabsTrigger>
          <TabsTrigger value="text" disabled={disabled} className="flex-1 gap-1.5">
            <FileText className="size-3.5" />
            Paste text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="mt-2">
          <input
            ref={inputRef}
            id={`${idPrefix}-file`}
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(",")}
            className="sr-only"
            disabled={disabled}
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          />
          {state.file ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-primary/5 p-3 ring-1 ring-primary/20">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {isImage ? (
                  <ImageIcon className="size-4.5" />
                ) : (
                  <FileText className="size-4.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {state.file.name}
                </span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {formatBytes(state.file.size)}
                </span>
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="shrink-0"
                disabled={disabled}
                aria-label={`Remove ${state.file.name}`}
                onClick={() => {
                  onChange({ ...state, file: null });
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                if (!disabled) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (!disabled) pickFile(event.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${
                dragging
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted/40 hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <span
                className={`flex size-9 items-center justify-center rounded-full transition-colors ${
                  dragging
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground ring-1 ring-foreground/10"
                }`}
              >
                <Upload className="size-4" />
              </span>
              <span className="text-sm font-medium">
                {dragging ? "Drop it here" : "Drag a file or browse"}
              </span>
              <span className="text-xs text-muted-foreground">PDF, JPG, PNG or WebP</span>
            </button>
          )}
          {fileError ? <p className="mt-2 text-xs text-high">{fileError}</p> : null}
        </TabsContent>

        <TabsContent value="text" className="mt-2">
          <Textarea
            id={`${idPrefix}-text`}
            value={state.text}
            onChange={(event) => onChange({ ...state, text: event.target.value })}
            placeholder="Paste the text of the document here"
            className="min-h-[124px]"
            disabled={disabled}
            maxLength={MAX_TEXT_CHARS}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchSample(name: string): Promise<File> {
  const response = await fetch(`/samples/${name}`);
  if (!response.ok) throw new Error(`Could not load ${name}`);
  const blob = await response.blob();
  return new File([blob], name, { type: "application/pdf" });
}
