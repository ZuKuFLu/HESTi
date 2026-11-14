import { toCentsOrZero } from "@/lib/money";
import type { AnalysisResult, Extraction, Flag, Match } from "@/lib/schemas";

/**
 * Projects live in the browser. There is no database and no account, so this
 * module is the whole persistence layer.
 *
 * Every read and write is wrapped: private windows, blocked site data and a
 * full storage quota all throw. When that happens the projects fall back to a
 * module-level array that lasts as long as the tab, and the UI says so.
 */

export const STORAGE_KEY = "hesti.projects.v1";

/** A renovation produces several change orders, but not hundreds. */
export const MAX_CHANGE_ORDERS = 10;

export type ChangeOrderStatus = "pending" | "approved" | "disputed";

export type ChangeOrderRecord = {
  id: string;
  addedAt: string;
  fileName: string | null;
  status: ChangeOrderStatus;
  extraction: Extraction;
  matches: Match[];
  flags: Flag[];
  atStakeCents: number;
  /** The model's reading was replayed from the recorded sample response. */
  prepared?: boolean;
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  paid: boolean;
  quote: Extraction;
  changeOrders: ChangeOrderRecord[];
};

export type ProjectTotals = {
  originalCents: number;
  /** Every change order, in the order they were added. */
  changeOrderCents: number[];
  /** Original quote plus the change orders that count toward the total. */
  currentCents: number;
  /** Change orders not yet counted (S1: the ones still pending). */
  pendingCents: number;
  /** "+31%" over the original quote, or "—" when the quote total is unknown. */
  percentOver: string;
};

/**
 * The running total shown on the project page.
 *
 * `countOnlyApproved` is the S1 behaviour and is off until S1 ships, so today
 * every change order counts toward the current total and nothing is pending.
 */
export function computeTotals(
  project: Pick<Project, "quote" | "changeOrders">,
  countOnlyApproved = false,
): ProjectTotals {
  const originalCents = toCentsOrZero(project.quote.total);
  const changeOrderCents = project.changeOrders.map((order) =>
    toCentsOrZero(order.extraction.total),
  );

  let countedCents = 0;
  let pendingCents = 0;

  project.changeOrders.forEach((order, index) => {
    const cents = changeOrderCents[index];
    if (countOnlyApproved && order.status !== "approved") {
      pendingCents += cents;
    } else {
      countedCents += cents;
    }
  });

  const currentCents = originalCents + countedCents;

  return {
    originalCents,
    changeOrderCents,
    currentCents,
    pendingCents,
    percentOver: percentOver(originalCents, currentCents),
  };
}

function percentOver(originalCents: number, currentCents: number): string {
  if (originalCents <= 0) return "—";
  const percent = ((currentCents - originalCents) / originalCents) * 100;
  const rounded = Math.abs(percent) < 10 ? percent.toFixed(1) : percent.toFixed(0);
  const trimmed = rounded.replace(/\.0$/, "");
  return `${percent > 0 ? "+" : ""}${trimmed}%`;
}

// --- storage ----------------------------------------------------------------

/** Used only when localStorage is unavailable; lives as long as the tab. */
let memoryProjects: Project[] | null = null;

/** False once a read or write has failed, so the UI can warn the homeowner. */
export function isPersistent(): boolean {
  return memoryProjects === null;
}

function readRaw(): Project[] {
  if (memoryProjects !== null) return memoryProjects;
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProject);
  } catch {
    // Storage is blocked or the contents are corrupt. Carry on in memory
    // rather than losing the session to an exception.
    memoryProjects = [];
    return memoryProjects;
  }
}

function writeRaw(projects: Project[]): void {
  if (memoryProjects !== null) {
    memoryProjects = projects;
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    memoryProjects = projects;
  }
}

/** A stored project is only as trustworthy as the browser that wrote it. */
function isProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Project>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.paid === "boolean" &&
    typeof candidate.quote === "object" &&
    candidate.quote !== null &&
    Array.isArray(candidate.changeOrders)
  );
}

/** Newest first, which is the order "Your projects" shows them in. */
export function listProjects(): Project[] {
  return [...readRaw()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProject(id: string): Project | null {
  return readRaw().find((project) => project.id === id) ?? null;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toChangeOrder(result: AnalysisResult, fileName: string | null): ChangeOrderRecord {
  return {
    id: newId(),
    addedAt: new Date().toISOString(),
    fileName,
    status: "pending",
    extraction: result.changeOrder,
    matches: result.matches,
    flags: result.flags,
    atStakeCents: result.atStakeCents,
    prepared: result.prepared,
  };
}

/** Creates the project the first analysis produces and returns its id. */
export function createProject(
  name: string,
  result: AnalysisResult,
  fileName: string | null,
): Project {
  const project: Project = {
    id: newId(),
    name,
    createdAt: new Date().toISOString(),
    paid: false,
    quote: result.quote,
    changeOrders: [toChangeOrder(result, fileName)],
  };

  writeRaw([...readRaw(), project]);
  return project;
}

export type AddChangeOrderOutcome =
  | { ok: true; project: Project }
  | { ok: false; reason: "not_found" | "limit_reached" };

export function addChangeOrder(
  id: string,
  result: AnalysisResult,
  fileName: string | null,
): AddChangeOrderOutcome {
  const projects = readRaw();
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) return { ok: false, reason: "not_found" };

  const existing = projects[index];
  if (existing.changeOrders.length >= MAX_CHANGE_ORDERS) {
    return { ok: false, reason: "limit_reached" };
  }

  const updated: Project = {
    ...existing,
    changeOrders: [...existing.changeOrders, toChangeOrder(result, fileName)],
  };
  const next = [...projects];
  next[index] = updated;
  writeRaw(next);

  return { ok: true, project: updated };
}

/** The demo checkout's only side effect. */
export function markPaid(id: string): Project | null {
  const projects = readRaw();
  const index = projects.findIndex((project) => project.id === id);
  if (index === -1) return null;

  const updated: Project = { ...projects[index], paid: true };
  const next = [...projects];
  next[index] = updated;
  writeRaw(next);

  return updated;
}

/** Test seam: the module-level fallback is otherwise invisible. */
export function resetStorageStateForTests(): void {
  memoryProjects = null;
}
