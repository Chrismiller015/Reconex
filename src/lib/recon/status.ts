import { fail, ok, type NormalizationResult } from "@/lib/recon/types";

export const CANONICAL_STATUSES = ["pending live", "live", "pending cancel", "cancelled"] as const;
export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

export function normalizeStatus(input: unknown): NormalizationResult<CanonicalStatus> {
  if (input === null || input === undefined) return fail("STATUS_MISSING", "Status is missing");
  const raw = String(input)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!raw) return fail("STATUS_EMPTY", "Status is empty");

  const normalized = raw === "canceled" ? "cancelled" : raw;

  if ((CANONICAL_STATUSES as readonly string[]).includes(normalized)) {
    return ok(normalized as CanonicalStatus);
  }
  return fail("STATUS_INVALID", `Status "${raw}" is not recognized`);
}

export function isBillableDiStatus(status: CanonicalStatus): boolean {
  return status === "live" || status === "pending cancel";
}

