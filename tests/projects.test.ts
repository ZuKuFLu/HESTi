import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_CHANGE_ORDERS,
  STORAGE_KEY,
  addChangeOrder,
  createProject,
  getProject,
  isPersistent,
  listProjects,
  markPaid,
  resetStorageStateForTests,
} from "@/lib/projects";
import type { AnalysisResult, Extraction } from "@/lib/schemas";

/** A localStorage good enough for these tests, and able to misbehave on cue. */
class FakeStorage {
  private data = new Map<string, string>();
  failOnWrite = false;
  failOnRead = false;

  getItem(key: string): string | null {
    if (this.failOnRead) throw new DOMException("denied");
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnWrite) throw new DOMException("quota exceeded");
    this.data.set(key, value);
  }

  seed(key: string, value: string): void {
    this.data.set(key, value);
  }
}

let storage: FakeStorage;

beforeEach(() => {
  storage = new FakeStorage();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
    writable: true,
  });
  resetStorageStateForTests();
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  resetStorageStateForTests();
});

function extraction(total: number | null): Extraction {
  return {
    is_relevant: true,
    contractor_name: null,
    document_number: null,
    document_date: null,
    line_items: [],
    subtotal: null,
    total,
    schedule: { start_date: null, end_date: null, change_reason: null },
    payment_terms: [],
    has_signature_or_approval: null,
  };
}

function result(quoteTotal: number, coTotal: number, atStakeCents = 0): AnalysisResult {
  return {
    quote: extraction(quoteTotal),
    changeOrder: extraction(coTotal),
    matches: [],
    flags: [],
    atStakeCents,
  };
}

describe("creating a project", () => {
  it("stores the quote and the first change order", () => {
    const project = createProject("Bathroom", result(8000, 2500, 136_000), "co1.pdf");

    const stored = getProject(project.id);
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe("Bathroom");
    expect(stored?.paid).toBe(false);
    expect(stored?.quote.total).toBe(8000);
    expect(stored?.changeOrders).toHaveLength(1);
    expect(stored?.changeOrders[0].fileName).toBe("co1.pdf");
    expect(stored?.changeOrders[0].status).toBe("pending");
    expect(stored?.changeOrders[0].atStakeCents).toBe(136_000);
  });

  it("gives every project its own id", () => {
    const a = createProject("A", result(8000, 2500), null);
    const b = createProject("B", result(9000, 500), null);

    expect(a.id).not.toBe(b.id);
    expect(listProjects()).toHaveLength(2);
  });

  it("returns null for an id that was never stored", () => {
    expect(getProject("nope")).toBeNull();
  });
});

describe("adding change orders", () => {
  it("appends to the existing project", () => {
    const project = createProject("Bathroom", result(8000, 2500), null);
    const outcome = addChangeOrder(project.id, result(8000, 525), "co2.pdf");

    expect(outcome.ok).toBe(true);
    expect(getProject(project.id)?.changeOrders).toHaveLength(2);
    expect(getProject(project.id)?.changeOrders[1].fileName).toBe("co2.pdf");
  });

  it("leaves the original quote alone", () => {
    const project = createProject("Bathroom", result(8000, 2500), null);
    addChangeOrder(project.id, result(1, 525), null);

    expect(getProject(project.id)?.quote.total).toBe(8000);
  });

  it("refuses once the project is full", () => {
    const project = createProject("Bathroom", result(8000, 100), null);
    for (let i = 1; i < MAX_CHANGE_ORDERS; i += 1) {
      expect(addChangeOrder(project.id, result(8000, 100), null).ok).toBe(true);
    }

    const outcome = addChangeOrder(project.id, result(8000, 100), null);
    expect(outcome).toEqual({ ok: false, reason: "limit_reached" });
    expect(getProject(project.id)?.changeOrders).toHaveLength(MAX_CHANGE_ORDERS);
  });

  it("reports a missing project rather than throwing", () => {
    expect(addChangeOrder("nope", result(8000, 100), null)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("the demo checkout", () => {
  it("marks the project paid and keeps it paid", () => {
    const project = createProject("Bathroom", result(8000, 2500), null);
    expect(getProject(project.id)?.paid).toBe(false);

    markPaid(project.id);
    expect(getProject(project.id)?.paid).toBe(true);

    addChangeOrder(project.id, result(8000, 525), null);
    expect(getProject(project.id)?.paid).toBe(true);
  });

  it("does not pay a project that isn't there", () => {
    expect(markPaid("nope")).toBeNull();
  });

  it("pays only the project asked for", () => {
    const a = createProject("A", result(8000, 2500), null);
    const b = createProject("B", result(8000, 2500), null);

    markPaid(a.id);

    expect(getProject(a.id)?.paid).toBe(true);
    expect(getProject(b.id)?.paid).toBe(false);
  });
});

describe("listing", () => {
  it("puts the newest project first", () => {
    const older = createProject("Older", result(8000, 2500), null);
    const newer = createProject("Newer", result(8000, 2500), null);

    // createdAt can land on the same millisecond, so make the order explicit.
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) as string);
    raw[0].createdAt = "2026-01-01T00:00:00.000Z";
    raw[1].createdAt = "2026-06-01T00:00:00.000Z";
    storage.seed(STORAGE_KEY, JSON.stringify(raw));

    expect(listProjects().map((project) => project.id)).toEqual([newer.id, older.id]);
  });
});

describe("when the browser won't cooperate", () => {
  it("survives corrupt stored data", () => {
    storage.seed(STORAGE_KEY, "{not json");
    expect(listProjects()).toEqual([]);
  });

  it("ignores stored entries that aren't projects", () => {
    storage.seed(STORAGE_KEY, JSON.stringify([{ id: "x" }, null, 42]));
    expect(listProjects()).toEqual([]);
  });

  it("keeps working in memory when writing is blocked, and says so", () => {
    storage.failOnWrite = true;

    const project = createProject("Bathroom", result(8000, 2500), null);

    expect(isPersistent()).toBe(false);
    expect(getProject(project.id)?.name).toBe("Bathroom");
    expect(addChangeOrder(project.id, result(8000, 525), null).ok).toBe(true);
    expect(getProject(project.id)?.changeOrders).toHaveLength(2);
  });

  it("keeps working in memory when reading is blocked", () => {
    storage.failOnRead = true;

    expect(listProjects()).toEqual([]);
    expect(isPersistent()).toBe(false);

    const project = createProject("Bathroom", result(8000, 2500), null);
    expect(getProject(project.id)?.name).toBe("Bathroom");
  });
});
