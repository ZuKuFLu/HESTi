import { toCentsOrZero } from "@/lib/money";
import type { Extraction, Flag, Match } from "@/lib/schemas";

/**
 * Projects live in the browser. There is no database and no account, so this
 * module is the whole persistence layer.
 *
 * Phase 2 uses the types and the pure total maths below; the localStorage
 * read/write helpers arrive with the project page in Phase 3.
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
