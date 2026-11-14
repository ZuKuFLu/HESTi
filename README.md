# HESTi

**Know what changed, what it costs, and what to ask — before you sign the change order.**

Track: **01 Money** (spending, owing).

- **Live URL:** _TBD (added at Checkpoint A)_
- **Pitch deck (PDF):** _TBD_

## The problem

A US homeowner hires a contractor at a fixed quote — say $8,000 for a bathroom.
Halfway through, a change order arrives for +$2,500. The homeowner can't tell
what actually changed, whether they're being charged twice for the same work,
why the completion date moved, or what questions to ask.

**Persona:** Maya, 32, first house. Her $8,000 bathroom remodel just got a
$2,500 change order.

## How it works

1. Upload the original quote and the change order (PDF, photo or pasted text).
2. **One AI call** reads both documents and compares them line by line.
3. A **rule engine in code** checks the math, totals, duplicate scope, payment
   terms, schedule and signature.
4. The report shows every problem with evidence from both documents, a
   plain-English explanation and a question to ask the contractor.

No sign-up, no login, no database. The project is saved in your browser with a
running total, so you can come back when the next change order arrives.

## Why the results are trustworthy

- All arithmetic is done in code, not by the model.
- Every flag cites the exact lines it came from, in both documents.
- Your files are never stored — they're sent to the model for one call and
  discarded.
- **Your uploads are always analyzed live.** Every document you provide is sent
  to Gemini for a real call; nothing about your result is pre-written.

### The one exception: the sample button

The free Gemini tier has a daily cap. To stop a demo dying when that cap is
hit, **one real Gemini response for the two sample PDFs is recorded into
`lib/sample-seed.json`** and used to pre-warm the response cache described in
`lib/gemini.ts`. The report says so on screen:

> Sample analysis prepared in advance. Your own uploads are analyzed live.

What this does and does not mean:

- The recording is a **genuine model output** for those exact PDFs, produced by
  `npm run record-sample`, not hand-written.
- It stores only the model's *reading* of the documents — the extracted line
  items, the quote/change-order matching, and its two judgment calls. It
  contains **no flags, no severities and no dollar findings**; those are
  computed live by `lib/rules.ts` on every single request, including this one.
- The cache is keyed by `sha256(model + prompt version + document bytes)`, so
  it can only ever match those two PDFs under that exact prompt and model. **A
  document you upload hashes differently and always calls Gemini.** If the
  prompt or model changes, the recording stops matching and is ignored rather
  than serving a stale answer.
- `tests/sample-seed.test.ts` enforces all of the above, including that a
  single changed byte misses the cache.

If you want to see the sample analyzed live instead, delete
`lib/sample-seed.json` (or run `npm run record-sample` to refresh it).

## Pricing

| | |
|---|---|
| **Free** | Original quote + first change order, full report |
| **Project Pass — $39 one-time per project** | Unlimited further change orders on that project, running total across all of them, printable report |
| **Home Plan — $49/yr** | Coming soon |

### How to test the paywall

Checkout is a **demo checkout** — no real payment is taken and no card details
are collected.

1. On the home page, press **Try a sample**. You land on the project page with
   the first report and a running total.
2. Press **Add another change order**. Because the project isn't paid, you get
   the paywall card: the $39 price, what's included, and a line drawn from your
   own report ("Your first change order had $1,360.00 at stake…").
3. Press **Unlock Project Pass** → the demo checkout, with an order summary and
   a banner saying no real payment is taken.
4. Press **Complete purchase**. You return to the project, unlocked.
5. Press **Add another change order** again and upload
   `public/samples/change-order-2.pdf`. The second report flags the haul-away
   fee as already covered by the original quote, and the running total updates
   to $11,025.00.

The pass is stored against that project in your browser, so clearing site data
resets it.

## Retention roadmap (not built yet)

Closeout check at the end of the job, a home record of everything done to the
house, any home quote (not just change orders), accounts and sync across
devices.

## Local setup

Requires **Node 24 LTS** (see `.nvmrc`). The project was specified against Node
20, but Node 20 reached end of life and the current Tailwind v4 and Vitest 4
toolchain requires `require(esm)` support, which landed in Node 20.19+.

```bash
npm install
cp .env.example .env.local   # then fill in GEMINI_API_KEY and GEMINI_MODEL
npm run dev
```

Other commands:

```bash
npm test                     # unit tests (Vitest)
npm run build                # production build
npm run samples              # regenerate the sample PDFs
npm run record-sample        # re-record the sample's Gemini response
```

## Limitations

- Projects are stored in **localStorage**, so they live in one browser only —
  they don't sync and clearing site data removes them.
- The paywall state also lives in localStorage, so it's client-side only. That's
  acceptable for this demo; it is not a real payment or entitlement system.
- Gemini's **free tier** has rate limits. When the quota is busy the app says so
  and asks you to retry. The sample button is insulated from this by the
  recorded response described above; your own uploads are not, because they are
  always analyzed live. Free-tier inputs may be used by Google to improve its
  products, so please don't upload documents with sensitive personal
  information.

## Disclaimer

Not legal, financial or construction advice. Flags are questions to ask, not
accusations.
