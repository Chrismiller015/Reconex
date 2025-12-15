import { BRAND_TOKENS, fail, ok, type BrandToken, type NormalizationIssue, type NormalizationResult } from "@/lib/recon/types";

function normalizeLettersPermutation(rawUpper: string): BrandToken | null {
  // Only accept permutations composed of B/C/G (no repeats).
  if (!/^[BCG]{1,3}$/.test(rawUpper)) return null;
  const letters = new Set(rawUpper.split(""));
  if (letters.size !== rawUpper.length) return null;

  const hasB = letters.has("B");
  const hasC = letters.has("C");
  const hasG = letters.has("G");

  if (hasB && hasC && hasG) return "CBG";
  if (hasB && hasG && !hasC) return "BG";
  if (hasC && hasB && !hasG) return "CB";
  if (hasC && hasG && !hasB) return "CG";
  if (hasC && !hasB && !hasG) return "C";
  if (hasB && !hasC && !hasG) return "B";
  if (hasG && !hasB && !hasC) return "G";
  return null;
}

export function normalizeBrandToken(input: unknown): NormalizationResult<BrandToken> {
  if (input === null || input === undefined) return fail("BRAND_MISSING", "Brand token is missing");

  const raw = String(input).trim();
  if (!raw) return fail("BRAND_EMPTY", "Brand token is empty");

  const upper = raw.toUpperCase();
  if (upper === "K") return ok("CAD");

  if ((BRAND_TOKENS as readonly string[]).includes(upper)) {
    return ok(upper as BrandToken);
  }

  const perm = normalizeLettersPermutation(upper);
  if (perm) return ok(perm);

  return fail("BRAND_INVALID", `Brand token "${raw}" cannot be normalized`);
}

export type BrandMismatch = {
  productBrand: BrandToken;
  productCodeBrand: BrandToken | null;
};

export function detectBrandMismatch(productBrand: BrandToken, productCodeBrand: BrandToken | null): NormalizationIssue | null {
  if (!productCodeBrand) return null;
  if (productBrand !== productCodeBrand) {
    return {
      code: "BRAND_MISMATCH",
      message: `Product Brand (${productBrand}) disagrees with Product Code brand token (${productCodeBrand})`,
    };
  }
  return null;
}


