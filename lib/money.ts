/**
 * Money helpers. The model reports dollars; everything we compute with is an
 * integer number of cents, so no arithmetic ever runs on a float.
 */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Dollars from the model -> integer cents. Returns null for a missing value. */
export function toCents(dollars: number | null | undefined): number | null {
  if (dollars === null || dollars === undefined) return null;
  if (!Number.isFinite(dollars)) return null;
  return Math.round(dollars * 100);
}

/** Same as toCents, but a missing value becomes 0 for summing. */
export function toCentsOrZero(dollars: number | null | undefined): number {
  return toCents(dollars) ?? 0;
}

/** Integer cents -> "$1,234.56". */
export function formatUsd(cents: number): string {
  return USD.format(cents / 100);
}

/** "12%" — how far over the original quote the project now runs. */
export function formatPercentOver(originalCents: number, currentCents: number): string {
  if (originalCents <= 0) return "—";
  const percent = ((currentCents - originalCents) / originalCents) * 100;
  return `${percent >= 0 ? "" : "-"}${Math.abs(percent).toFixed(percent % 1 === 0 ? 0 : 1)}%`;
}

/** MM/DD/YYYY, the only date format this product shows. */
export function formatDate(value: string | null): string | null {
  const parsed = parseDate(value);
  if (!parsed) return value;
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${parsed.getUTCFullYear()}`;
}

/**
 * Tolerant date parser. The model is told to copy dates as written, so we may
 * get MM/DD/YYYY or ISO. Anything else returns null and the caller treats the
 * date as unknown rather than guessing.
 */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const text = value.trim();

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (slash) {
    const [, month, day, year] = slash;
    return utcDate(Number(year), Number(month), Number(day));
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) {
    const [, year, month, day] = iso;
    return utcDate(Number(year), Number(month), Number(day));
  }

  return null;
}

function utcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}
