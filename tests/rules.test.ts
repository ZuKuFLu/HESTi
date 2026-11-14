import { describe, expect, it } from "vitest";
import { runRules, sanitize } from "@/lib/rules";
import { computeTotals } from "@/lib/projects";
import type {
  Extraction,
  Flag,
  FlagType,
  JudgmentFlag,
  LineItem,
  Match,
  PaymentTerm,
} from "@/lib/schemas";

// --- fixtures ---------------------------------------------------------------
// Hand-written, not captured from the model: these tests must fail when a rule
// changes, not when the model phrases something differently.

function line(overrides: Partial<LineItem> & { id: string }): LineItem {
  return {
    description: `Line ${overrides.id}`,
    category: "other",
    qty: null,
    unit: null,
    unit_price: null,
    total: null,
    is_allowance: false,
    allowance_amount: null,
    ...overrides,
  };
}

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    is_relevant: true,
    contractor_name: "Summit Home Renovations LLC",
    document_number: null,
    document_date: null,
    line_items: [],
    subtotal: null,
    total: null,
    schedule: { start_date: null, end_date: null, change_reason: null },
    payment_terms: [],
    has_signature_or_approval: null,
    ...overrides,
  };
}

function term(overrides: Partial<PaymentTerm> = {}): PaymentTerm {
  return {
    label: "Deposit",
    amount: null,
    percent: null,
    due: null,
    ...overrides,
  };
}

function run(args: {
  quote?: Extraction;
  changeOrder: Extraction;
  matches?: Match[];
  judgmentFlags?: JudgmentFlag[];
}) {
  return runRules({
    quote: args.quote ?? extraction(),
    changeOrder: args.changeOrder,
    matches: args.matches ?? [],
    judgmentFlags: args.judgmentFlags ?? [],
  });
}

const typesOf = (flags: Flag[]): FlagType[] => flags.map((flag) => flag.type);
const find = (flags: Flag[], type: FlagType) =>
  flags.find((flag) => flag.type === type);

// --- math_line --------------------------------------------------------------

describe("math_line", () => {
  it("flags a line whose quantity times unit price misses the total", () => {
    // The planted error in the sample: 3 x $180 is $540, but the line says $640.
    const { flags } = run({
      changeOrder: extraction({
        line_items: [line({ id: "C4", qty: 3, unit_price: 180, total: 640 })],
      }),
    });

    const flag = find(flags, "math_line");
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe("high");
    expect(flag?.amountCents).toBe(10_000);
    expect(flag?.coLineIds).toEqual(["C4"]);
    expect(flag?.source).toBe("rule");
    expect(flag?.explanation).toContain("$540.00");
    expect(flag?.explanation).toContain("$640.00");
  });

  it("ignores a difference of a dollar or less", () => {
    const { flags } = run({
      changeOrder: extraction({
        line_items: [line({ id: "C1", qty: 3, unit_price: 33.33, total: 100 })],
      }),
    });

    expect(typesOf(flags)).not.toContain("math_line");
  });

  it("stays quiet when the line has no quantity or unit price to check", () => {
    const { flags } = run({
      changeOrder: extraction({ line_items: [line({ id: "C1", total: 130 })] }),
    });

    expect(typesOf(flags)).not.toContain("math_line");
  });

  it("handles fractional quantities without floating point drift", () => {
    const { flags } = run({
      changeOrder: extraction({
        line_items: [
          line({ id: "C1", qty: 1.15, unit_price: 0.1, total: 0.115 }),
        ],
      }),
    });

    expect(typesOf(flags)).not.toContain("math_line");
  });
});

// --- math_total -------------------------------------------------------------

describe("math_total", () => {
  it("flags lines that do not add up to the stated total", () => {
    const { flags } = run({
      changeOrder: extraction({
        line_items: [
          line({ id: "C1", total: 600 }),
          line({ id: "C2", total: 450 }),
        ],
        total: 1200,
      }),
    });

    const flag = find(flags, "math_total");
    expect(flag?.severity).toBe("high");
    expect(flag?.amountCents).toBe(15_000);
    expect(flag?.explanation).toContain("$1,050.00");
    expect(flag?.explanation).toContain("$1,200.00");
  });

  it("accepts a total that matches the lines", () => {
    const { flags } = run({
      changeOrder: extraction({
        line_items: [
          line({ id: "C1", total: 600 }),
          line({ id: "C2", total: 450 }),
        ],
        total: 1050,
      }),
    });

    expect(typesOf(flags)).not.toContain("math_total");
  });

  it("stays quiet when the document states no total", () => {
    const { flags } = run({
      changeOrder: extraction({ line_items: [line({ id: "C1", total: 600 })] }),
    });

    expect(typesOf(flags)).not.toContain("math_total");
  });
});

// --- duplicate_scope --------------------------------------------------------

describe("duplicate_scope", () => {
  it("flags a change order line the quote already covers", () => {
    const { flags } = run({
      quote: extraction({
        line_items: [
          line({
            id: "Q1",
            description: "Demolition and haul-away",
            total: 900,
          }),
        ],
      }),
      changeOrder: extraction({
        line_items: [
          line({ id: "C3", description: "Haul-away fee", total: 250 }),
        ],
      }),
      matches: [
        {
          co_line_id: "C3",
          quote_line_id: "Q1",
          relation: "already_included",
          reason: "same work",
        },
      ],
    });

    const flag = find(flags, "duplicate_scope");
    expect(flag?.severity).toBe("high");
    expect(flag?.amountCents).toBe(25_000);
    expect(flag?.coLineIds).toEqual(["C3"]);
    expect(flag?.quoteLineIds).toEqual(["Q1"]);
    expect(flag?.explanation).toContain("Demolition and haul-away");
  });

  it("does not flag a genuinely new line", () => {
    const { flags } = run({
      changeOrder: extraction({ line_items: [line({ id: "C1", total: 450 })] }),
      matches: [
        {
          co_line_id: "C1",
          quote_line_id: null,
          relation: "new",
          reason: "new work",
        },
      ],
    });

    expect(typesOf(flags)).not.toContain("duplicate_scope");
  });
});

// --- AI judgment flags ------------------------------------------------------

describe("judgment flags from the model", () => {
  it("turns vague_item into a medium flag priced at the cited line", () => {
    const { flags } = run({
      changeOrder: extraction({
        line_items: [
          line({ id: "C5", description: "Misc. additional work", total: 130 }),
        ],
      }),
      judgmentFlags: [
        {
          type: "vague_item",
          co_line_ids: ["C5"],
          explanation: "This line does not say what work is included.",
          question: "What does this cover?",
        },
      ],
    });

    const flag = find(flags, "vague_item");
    expect(flag?.severity).toBe("medium");
    expect(flag?.amountCents).toBe(13_000);
    expect(flag?.source).toBe("ai");
    expect(flag?.explanation).toBe(
      "This line does not say what work is included.",
    );
    expect(flag?.question).toBe("What does this cover?");
  });

  it("prices labor_without_scope across every line it cites", () => {
    const { flags } = run({
      changeOrder: extraction({
        line_items: [
          line({ id: "C3", total: 680 }),
          line({ id: "C4", total: 640 }),
        ],
      }),
      judgmentFlags: [
        {
          type: "labor_without_scope",
          co_line_ids: ["C3", "C4"],
          explanation: "No scope given.",
          question: "What is this labor for?",
        },
      ],
    });

    expect(find(flags, "labor_without_scope")?.amountCents).toBe(132_000);
  });
});

// --- payment_terms_changed --------------------------------------------------

describe("payment_terms_changed", () => {
  it("flags payment demanded in full up front", () => {
    const { flags } = run({
      changeOrder: extraction({
        total: 2500,
        payment_terms: [
          term({ label: "Change order amount due in full upon signing" }),
        ],
      }),
    });

    const flag = find(flags, "payment_terms_changed");
    expect(flag?.severity).toBe("medium");
    expect(flag?.amountCents).toBe(0);
  });

  it("flags a stated percentage of half or more before completion", () => {
    const { flags } = run({
      changeOrder: extraction({
        total: 2500,
        payment_terms: [
          term({ label: "Deposit", percent: 50, due: "at signing" }),
        ],
      }),
    });

    expect(typesOf(flags)).toContain("payment_terms_changed");
  });

  it("flags an amount that is half or more of the change order", () => {
    const { flags } = run({
      changeOrder: extraction({
        total: 2500,
        payment_terms: [
          term({ label: "Deposit", amount: 1250, due: "at signing" }),
        ],
      }),
    });

    expect(typesOf(flags)).toContain("payment_terms_changed");
  });

  it("accepts money held back until completion", () => {
    const { flags } = run({
      changeOrder: extraction({
        total: 2500,
        payment_terms: [
          term({ label: "Balance due in full at completion", percent: 100 }),
        ],
      }),
    });

    expect(typesOf(flags)).not.toContain("payment_terms_changed");
  });

  it("accepts a small deposit", () => {
    const { flags } = run({
      changeOrder: extraction({
        total: 2500,
        payment_terms: [
          term({ label: "Deposit", percent: 20, due: "at signing" }),
        ],
      }),
    });

    expect(typesOf(flags)).not.toContain("payment_terms_changed");
  });

  it("raises the flag only once even with several aggressive terms", () => {
    const { flags } = run({
      changeOrder: extraction({
        total: 2500,
        payment_terms: [
          term({ label: "Due in full upon signing" }),
          term({ label: "Deposit", percent: 75, due: "at signing" }),
        ],
      }),
    });

    expect(
      flags.filter((flag) => flag.type === "payment_terms_changed"),
    ).toHaveLength(1);
  });
});

// --- allowance_overrun ------------------------------------------------------

describe("allowance_overrun", () => {
  it("reports an allowance adjustment as info worth confirming", () => {
    const { flags } = run({
      quote: extraction({
        line_items: [
          line({
            id: "Q5",
            description: "Tile material ALLOWANCE",
            total: 1500,
            is_allowance: true,
            allowance_amount: 1500,
          }),
        ],
      }),
      changeOrder: extraction({
        line_items: [
          line({
            id: "C1",
            description: "Tile upgrade over allowance",
            total: 600,
          }),
        ],
      }),
      matches: [
        {
          co_line_id: "C1",
          quote_line_id: "Q5",
          relation: "allowance_adjustment",
          reason: "over the tile allowance",
        },
      ],
    });

    const flag = find(flags, "allowance_overrun");
    expect(flag?.severity).toBe("info");
    expect(flag?.amountCents).toBe(0);
    expect(flag?.question).toContain("$1,500.00");
  });
});

// --- schedule_slip ----------------------------------------------------------

describe("schedule_slip", () => {
  it("flags a later completion date with no reason given", () => {
    const { flags } = run({
      quote: extraction({
        schedule: {
          start_date: "10/20/2026",
          end_date: "11/21/2026",
          change_reason: null,
        },
      }),
      changeOrder: extraction({
        schedule: {
          start_date: null,
          end_date: "11/30/2026",
          change_reason: null,
        },
      }),
    });

    const flag = find(flags, "schedule_slip");
    expect(flag?.severity).toBe("info");
    expect(flag?.explanation).toContain("11/21/2026");
    expect(flag?.explanation).toContain("11/30/2026");
    expect(flag?.explanation).toContain("9 days");
  });

  it("stays quiet when the change order explains the delay", () => {
    const { flags } = run({
      quote: extraction({
        schedule: {
          start_date: null,
          end_date: "11/21/2026",
          change_reason: null,
        },
      }),
      changeOrder: extraction({
        schedule: {
          start_date: null,
          end_date: "11/30/2026",
          change_reason: "Tile delivery delayed by supplier",
        },
      }),
    });

    expect(typesOf(flags)).not.toContain("schedule_slip");
  });

  it("stays quiet when the date did not move", () => {
    const { flags } = run({
      quote: extraction({
        schedule: {
          start_date: null,
          end_date: "11/21/2026",
          change_reason: null,
        },
      }),
      changeOrder: extraction({
        schedule: {
          start_date: null,
          end_date: "11/21/2026",
          change_reason: null,
        },
      }),
    });

    expect(typesOf(flags)).not.toContain("schedule_slip");
  });

  it("stays quiet when a date is missing or unparseable", () => {
    const { flags } = run({
      quote: extraction({
        schedule: {
          start_date: null,
          end_date: "sometime in November",
          change_reason: null,
        },
      }),
      changeOrder: extraction({
        schedule: {
          start_date: null,
          end_date: "11/30/2026",
          change_reason: null,
        },
      }),
    });

    expect(typesOf(flags)).not.toContain("schedule_slip");
  });
});

// --- not_signed -------------------------------------------------------------

describe("not_signed", () => {
  it("flags an unsigned change order", () => {
    const { flags } = run({
      changeOrder: extraction({ has_signature_or_approval: false }),
    });

    expect(find(flags, "not_signed")?.severity).toBe("info");
  });

  it("does not guess when the model could not tell", () => {
    const { flags } = run({
      changeOrder: extraction({ has_signature_or_approval: null }),
    });

    expect(typesOf(flags)).not.toContain("not_signed");
  });
});

// --- $ at stake -------------------------------------------------------------

describe("$ at stake", () => {
  it("counts a line once even when several flags hit it", () => {
    // C3 is both a duplicate ($250) and vague ($250). It must count once.
    const { atStakeCents } = run({
      quote: extraction({ line_items: [line({ id: "Q1", total: 900 })] }),
      changeOrder: extraction({ line_items: [line({ id: "C3", total: 250 })] }),
      matches: [
        {
          co_line_id: "C3",
          quote_line_id: "Q1",
          relation: "already_included",
          reason: "same",
        },
      ],
      judgmentFlags: [
        {
          type: "vague_item",
          co_line_ids: ["C3"],
          explanation: "x",
          question: "y",
        },
      ],
    });

    expect(atStakeCents).toBe(25_000);
  });

  it("takes the largest amount on a line, not the first", () => {
    // C4: math error is $100, duplicate scope is the full $640.
    const { atStakeCents } = run({
      quote: extraction({ line_items: [line({ id: "Q1", total: 900 })] }),
      changeOrder: extraction({
        line_items: [line({ id: "C4", qty: 3, unit_price: 180, total: 640 })],
      }),
      matches: [
        {
          co_line_id: "C4",
          quote_line_id: "Q1",
          relation: "already_included",
          reason: "same",
        },
      ],
    });

    expect(atStakeCents).toBe(64_000);
  });

  it("adds the total mismatch on top of the per-line amounts", () => {
    const { atStakeCents } = run({
      quote: extraction({ line_items: [line({ id: "Q1", total: 900 })] }),
      changeOrder: extraction({
        line_items: [
          line({ id: "C1", total: 250 }),
          line({ id: "C2", total: 100 }),
        ],
        total: 500,
      }),
      matches: [
        {
          co_line_id: "C1",
          quote_line_id: "Q1",
          relation: "already_included",
          reason: "same",
        },
      ],
    });

    // $250 duplicate + $150 total mismatch.
    expect(atStakeCents).toBe(40_000);
  });

  it("ignores info-level flags", () => {
    const { atStakeCents } = run({
      changeOrder: extraction({
        line_items: [line({ id: "C1", total: 600 })],
        has_signature_or_approval: false,
      }),
      matches: [
        {
          co_line_id: "C1",
          quote_line_id: null,
          relation: "allowance_adjustment",
          reason: "allowance",
        },
      ],
    });

    expect(atStakeCents).toBe(0);
  });
});

// --- ordering and sanitising ------------------------------------------------

describe("flag ordering", () => {
  it("sorts high before medium before info, then by amount", () => {
    const { flags } = run({
      quote: extraction({ line_items: [line({ id: "Q1", total: 900 })] }),
      changeOrder: extraction({
        line_items: [
          line({ id: "C1", total: 250 }),
          line({ id: "C2", qty: 3, unit_price: 180, total: 640 }),
          line({ id: "C3", total: 130 }),
        ],
        total: 1020,
        has_signature_or_approval: false,
      }),
      matches: [
        {
          co_line_id: "C1",
          quote_line_id: "Q1",
          relation: "already_included",
          reason: "same",
        },
      ],
      judgmentFlags: [
        {
          type: "vague_item",
          co_line_ids: ["C3"],
          explanation: "x",
          question: "y",
        },
      ],
    });

    const severities = flags.map((flag) => flag.severity);
    expect(severities).toEqual(
      [...severities].sort((a, b) => {
        const order = { high: 0, medium: 1, info: 2 };
        return order[a] - order[b];
      }),
    );

    const high = flags
      .filter((flag) => flag.severity === "high")
      .map((flag) => flag.amountCents);
    expect(high).toEqual([...high].sort((a, b) => b - a));
  });
});

describe("sanitize", () => {
  it("drops matches and judgment flags citing line ids that do not exist", () => {
    const input = {
      quote: extraction({ line_items: [line({ id: "Q1", total: 900 })] }),
      changeOrder: extraction({ line_items: [line({ id: "C1", total: 250 })] }),
      matches: [
        {
          co_line_id: "C1",
          quote_line_id: "Q1",
          relation: "already_included" as const,
          reason: "a",
        },
        {
          co_line_id: "C9",
          quote_line_id: "Q1",
          relation: "already_included" as const,
          reason: "b",
        },
        {
          co_line_id: "C1",
          quote_line_id: "Q9",
          relation: "changed" as const,
          reason: "c",
        },
      ],
      judgmentFlags: [
        {
          type: "vague_item" as const,
          co_line_ids: ["C1", "C9"],
          explanation: "x",
          question: "y",
        },
        {
          type: "vague_item" as const,
          co_line_ids: ["C9"],
          explanation: "x",
          question: "y",
        },
      ],
    };

    const clean = sanitize(input);
    expect(clean.matches).toHaveLength(1);
    expect(clean.matches[0].co_line_id).toBe("C1");
    expect(clean.judgmentFlags).toHaveLength(1);
    expect(clean.judgmentFlags[0].co_line_ids).toEqual(["C1"]);
  });

  it("does not let a hallucinated line id reach the flags", () => {
    const { flags } = run({
      changeOrder: extraction({ line_items: [line({ id: "C1", total: 250 })] }),
      judgmentFlags: [
        {
          type: "vague_item",
          co_line_ids: ["C99"],
          explanation: "x",
          question: "y",
        },
      ],
    });

    expect(typesOf(flags)).not.toContain("vague_item");
  });
});

// --- running total ----------------------------------------------------------

describe("running total", () => {
  const project = {
    quote: extraction({ total: 8000 }),
    changeOrders: [
      {
        id: "a",
        addedAt: "2026-11-03T00:00:00.000Z",
        fileName: "change-order-1.pdf",
        status: "pending" as const,
        extraction: extraction({ total: 2500 }),
        matches: [],
        flags: [],
        atStakeCents: 0,
      },
      {
        id: "b",
        addedAt: "2026-11-12T00:00:00.000Z",
        fileName: "change-order-2.pdf",
        status: "approved" as const,
        extraction: extraction({ total: 525 }),
        matches: [],
        flags: [],
        atStakeCents: 0,
      },
    ],
  };

  it("counts only approved change orders toward the current total", () => {
    const totals = computeTotals(project);

    expect(totals.originalCents).toBe(800_000);
    expect(totals.changeOrderCents).toEqual([250_000, 52_500]);
    expect(totals.currentCents).toBe(852_500);
    expect(totals.pendingCents).toBe(250_000);
    expect(totals.disputedCents).toBe(0);
    expect(totals.percentOver).toBe("+6.6%");
  });

  it("can still report the worst case if everything is approved", () => {
    const totals = computeTotals(project, true);

    expect(totals.currentCents).toBe(1_102_500);
    expect(totals.pendingCents).toBe(0);
    expect(totals.percentOver).toBe("+38%");
  });

  it("keeps disputed money apart from pending money", () => {
    const disputed = {
      quote: project.quote,
      changeOrders: [
        { ...project.changeOrders[0], status: "disputed" as const },
        project.changeOrders[1],
      ],
    };
    const totals = computeTotals(disputed);

    expect(totals.currentCents).toBe(852_500);
    expect(totals.pendingCents).toBe(0);
    expect(totals.disputedCents).toBe(250_000);
  });

  it("handles a project with no change orders yet", () => {
    const totals = computeTotals({
      quote: extraction({ total: 8000 }),
      changeOrders: [],
    });

    expect(totals.currentCents).toBe(800_000);
    expect(totals.percentOver).toBe("0%");
  });

  it("does not divide by an unknown quote total", () => {
    const totals = computeTotals({
      quote: extraction({ total: null }),
      changeOrders: [],
    });

    expect(totals.originalCents).toBe(0);
    expect(totals.percentOver).toBe("—");
  });
});
