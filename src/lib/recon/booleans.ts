import { fail, ok, type NormalizationResult } from "@/lib/recon/types";

function compactUpper(input: unknown): string {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function normalizeIsBilling(input: unknown): NormalizationResult<boolean> {
  if (input === null || input === undefined) return ok(false);
  const value = compactUpper(input);
  if (!value) return ok(false);

  const truthy = new Set(["TRUE", "BILLING", "ISBILLING", "1"]);
  const falsy = new Set(["FALSE", "NOTBILLING", "0"]);

  if (truthy.has(value)) return ok(true);
  if (falsy.has(value)) return ok(false);

  return fail("IS_BILLING_INVALID", `Is Billing value "${String(input)}" is not recognized`);
}

export function normalizeIsTerminated(input: unknown): NormalizationResult<boolean> {
  if (input === null || input === undefined) return ok(false);
  const value = String(input ?? "").trim().toUpperCase();
  if (!value) return ok(false);

  if (value === "Y") return ok(true);
  if (value === "N") return ok(false);

  return fail("IS_TERMINATED_INVALID", `Is Terminated value "${String(input)}" is not recognized`);
}

