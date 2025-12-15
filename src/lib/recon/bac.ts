import { fail, ok, type NormalizationResult } from "@/lib/recon/types";

export function normalizeBac(input: unknown): NormalizationResult<string> {
  if (input === null || input === undefined) {
    return fail("BAC_MISSING", "BAC is missing");
  }

  const raw = String(input).trim();
  if (!raw) return fail("BAC_EMPTY", "BAC is empty");

  const digits = raw.replace(/\D+/g, "");
  if (!digits) return fail("BAC_INVALID", `BAC "${raw}" has no digits`);
  if (digits.length > 6) return fail("BAC_INVALID", `BAC "${raw}" has more than 6 digits`);

  return ok(digits.padStart(6, "0"));
}


