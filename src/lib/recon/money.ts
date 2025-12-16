import Decimal from "decimal.js";
import { fail, ok, type NormalizationResult } from "@/lib/recon/types";

export const MONEY_TOLERANCE = new Decimal("0.01");

export function parseMoney(input: unknown): NormalizationResult<Decimal> {
  if (input === null || input === undefined) return fail("MONEY_MISSING", "Money value is missing");

  if (input instanceof Decimal) return ok(input);
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return fail("MONEY_INVALID", `Money value "${String(input)}" is not finite`);
    return ok(new Decimal(input));
  }

  const raw = String(input).trim();
  if (!raw) return fail("MONEY_EMPTY", "Money value is empty");

  // Be forgiving, but not sloppy:
  // - allow optional accounting parentheses for negatives
  // - strip currency symbols, commas, and whitespace
  let negative = false;
  let core = raw;
  const parenMatch = core.match(/^\((.*)\)$/);
  if (parenMatch) {
    negative = true;
    core = parenMatch[1] ?? "";
  }

  const dollarCount = (core.match(/\$/g) ?? []).length;
  if (dollarCount > 1) {
    return fail("MONEY_INVALID", `Money value "${raw}" cannot be parsed`);
  }

  // Strip currency symbols/thousands separators/spaces.
  core = core.replace(/[\s$,]/g, "");
  if (!core) return fail("MONEY_EMPTY", "Money value is empty");

  // Reject obviously-invalid strings like "$$1" or "12-34"
  if (!/^[+-]?\d+(\.\d+)?$/.test(core)) {
    return fail("MONEY_INVALID", `Money value "${raw}" cannot be parsed`);
  }

  const cleaned = negative && !core.startsWith("-") ? `-${core.replace(/^\+/, "")}` : core;
  try {
    const dec = new Decimal(cleaned);
    if (!dec.isFinite()) return fail("MONEY_INVALID", `Money value "${raw}" is not finite`);
    return ok(dec);
  } catch {
    return fail("MONEY_INVALID", `Money value "${raw}" cannot be parsed`);
  }
}

export function moneyToDisplay(dec: Decimal): string {
  return dec.toFixed(2);
}

export function withinMoneyTolerance(a: Decimal, b: Decimal, tolerance: Decimal = MONEY_TOLERANCE): boolean {
  return a.sub(b).abs().lte(tolerance);
}



