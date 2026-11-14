export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1100px] items-center px-5 py-4">
          <span className="text-lg font-semibold tracking-tight">HESTi</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-14">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Understand your contractor&apos;s change order
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Your bathroom was quoted at $8,000. Now there&apos;s a change order
          for $2,500. HESTi compares it with your original quote, checks the
          math and tells you exactly what to ask.
        </p>
        <p className="mt-10 text-sm text-muted-foreground">
          Phase 1 setup build. The upload panel and the report are not wired up
          yet.
        </p>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-[1100px] px-5 py-6 text-xs text-muted-foreground">
          Not legal, financial or construction advice. Flags are questions to
          ask, not accusations.
        </div>
      </footer>
    </div>
  );
}
