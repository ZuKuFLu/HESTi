"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ACCEPTED_FILE_TYPES, isAcceptedFile, prepareFileForUpload } from "@/lib/image";
import type { AnalysisResult } from "@/lib/schemas";

const DEFAULT_PROJECT_NAME = "My renovation";
const SAMPLE_PROJECT_NAME = "Sample: Maya's bathroom remodel";
const MAX_TEXT_CHARS = 20_000;

const PROGRESS_STEPS = [
  "Reading your documents…",
  "Comparing with your quote…",
  "Checking the math…",
] as const;

export type AnalysisPayload = {
  result: AnalysisResult;
  projectName: string;
  changeOrderFileName: string | null;
};

type SlotState = { mode: "file" | "text"; file: File | null; text: string };

const emptySlot = (): SlotState => ({ mode: "file", file: null, text: "" });

export function UploadPanel({
  onResult,
}: {
  onResult: (payload: AnalysisPayload) => void;
}) {
  const [quote, setQuote] = useState<SlotState>(emptySlot);
  const [changeOrder, setChangeOrder] = useState<SlotState>(emptySlot);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<null | "form" | "sample">(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      stopProgress();
      setBusy(false);
    }
  }

  async function submitForm() {
    const quoteReady = quote.mode === "file" ? quote.file : quote.text.trim();
    const coReady = changeOrder.mode === "file" ? changeOrder.file : changeOrder.text.trim();

    if (!quoteReady) {
      setError("Please add your original quote.");
      return;
    }
    if (!coReady) {
      setError("Please add the change order.");
      return;
    }

    setLastRun("form");
    const form = new FormData();

    if (quote.mode === "file" && quote.file) {
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
    <Card className="border-2">
      <CardContent className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <DocumentSlot
            label="Original quote"
            hint="The estimate you agreed to"
            state={quote}
            onChange={setQuote}
            disabled={busy}
            idPrefix="quote"
          />
          <DocumentSlot
            label="Change order"
            hint="The new document asking for more"
            state={changeOrder}
            onChange={setChangeOrder}
            disabled={busy}
            idPrefix="co"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="project-name" className="text-sm font-medium">
            Project name <span className="font-normal text-muted-foreground">(optional)</span>
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

        {busy ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin" />
              {PROGRESS_STEPS[step]}
            </div>
            <Progress value={((step + 1) / PROGRESS_STEPS.length) * 100} />
          </div>
        ) : null}

        {error && !busy ? (
          <div
            role="alert"
            className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
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
          <Button onClick={submitForm} disabled={busy} size="lg" className="sm:flex-1">
            {busy ? "Checking…" : "Check my change order"}
          </Button>
          <Button onClick={submitSample} disabled={busy} size="lg" variant="outline">
            Try a sample
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Demo build on a free AI tier: please don&apos;t upload documents with sensitive
          personal information.
        </p>
      </CardContent>
    </Card>
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

  function pickFile(file: File | null) {
    if (!file) return;
    if (!isAcceptedFile(file)) {
      setFileError("Please choose a PDF, JPG, PNG or WebP file.");
      return;
    }
    setFileError(null);
    onChange({ ...state, file });
  }

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
          <TabsTrigger value="file" disabled={disabled} className="flex-1">
            Upload
          </TabsTrigger>
          <TabsTrigger value="text" disabled={disabled} className="flex-1">
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
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{state.file.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
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
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start gap-2 py-3 font-normal"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Choose a PDF or photo</span>
            </Button>
          )}
          {fileError ? <p className="mt-2 text-xs text-red-700">{fileError}</p> : null}
        </TabsContent>

        <TabsContent value="text" className="mt-2">
          <Textarea
            id={`${idPrefix}-text`}
            value={state.text}
            onChange={(event) => onChange({ ...state, text: event.target.value })}
            placeholder="Paste the text of the document here"
            className="min-h-[104px]"
            disabled={disabled}
            maxLength={MAX_TEXT_CHARS}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function fetchSample(name: string): Promise<File> {
  const response = await fetch(`/samples/${name}`);
  if (!response.ok) throw new Error(`Could not load ${name}`);
  const blob = await response.blob();
  return new File([blob], name, { type: "application/pdf" });
}
