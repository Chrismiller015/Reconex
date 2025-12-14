import { fail, ok, type NormalizationResult } from "@/lib/recon/types";
import type { CanonicalStatus } from "@/lib/recon/status";

export function utcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function utcTodayStart(now: Date = new Date()): Date {
  return utcStartOfDay(now);
}

export function parseGmEffectiveDate(input: unknown): NormalizationResult<Date> {
  if (input === null || input === undefined) return fail("DATE_MISSING", "Effective Date is missing");
  const raw = String(input).trim();
  if (!raw) return fail("DATE_EMPTY", "Effective Date is empty");

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return fail("DATE_INVALID", `Effective Date "${raw}" cannot be parsed as ISO date`);
  return ok(utcStartOfDay(date));
}

export function parseDiEffectiveDate(input: unknown): NormalizationResult<Date> {
  if (input === null || input === undefined) return fail("DATE_MISSING", "effectiveDate is missing");
  const raw = String(input).trim();
  if (!raw) return fail("DATE_EMPTY", "effectiveDate is empty");

  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return fail("DATE_INVALID", `effectiveDate "${raw}" must be in MM/DD/YYYY format`);

  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Validate round-trip (catches invalid like 13/40/2025).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return fail("DATE_INVALID", `effectiveDate "${raw}" is not a valid calendar date`);
  }
  return ok(date);
}

export function expectedBillableForGmDesyncFlag(
  status: CanonicalStatus,
  effectiveDateUtc: Date,
  now: Date = new Date(),
): boolean {
  const today = utcTodayStart(now);
  const effective = utcStartOfDay(effectiveDateUtc);

  const isBeforeToday = effective.getTime() < today.getTime();
  const isAfterToday = effective.getTime() > today.getTime();

  if (status === "pending live" || status === "live") return isBeforeToday;
  // pending cancel or cancelled/canceled => expected billable iff effective date > today
  return isAfterToday;
}

