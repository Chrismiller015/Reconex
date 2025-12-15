import { fail, ok, type BrandToken, type NormalizationIssue, type NormalizationResult } from "@/lib/recon/types";
import { normalizeBrandToken } from "@/lib/recon/brand";

export type ParsedProductCode = {
  raw: string;
  vendorCode: string;
  productCode: string;
  brandTokenFromCode: BrandToken | null;
  isSecondary: boolean;
  issues: NormalizationIssue[];
};

export function parseProductCode(input: unknown): NormalizationResult<ParsedProductCode> {
  if (input === null || input === undefined) return fail("PRODUCT_CODE_MISSING", "Product Code is missing");
  const raw = String(input).trim();
  if (!raw) return fail("PRODUCT_CODE_EMPTY", "Product Code is empty");

  const parts = raw.split("_").filter((p) => p.length > 0);
  if (parts.length !== 3 && parts.length !== 4) {
    return fail("PRODUCT_CODE_INVALID", `Product Code "${raw}" must have 3 or 4 underscore-delimited tokens`);
  }

  const [vendorCode, productCode, brandTokenRaw, suffix] = parts;
  const issues: NormalizationIssue[] = [];

  const brandRes = normalizeBrandToken(brandTokenRaw);
  const brandTokenFromCode = brandRes.ok ? brandRes.value : null;
  if (!brandRes.ok) {
    issues.push(...brandRes.issues.map((i) => ({ code: `PRODUCT_CODE_${i.code}`, message: i.message })));
  }

  const isSecondary = parts.length === 4;
  if (isSecondary) {
    if ((suffix ?? "").toUpperCase() !== "SEC") {
      return fail("PRODUCT_CODE_INVALID", `Product Code "${raw}" has 4 tokens but does not end with "_SEC"`);
    }

    const brandUpper = String(brandTokenRaw).toUpperCase();
    if (brandUpper === "CB" || brandUpper === "CG") {
      issues.push({
        code: "PRODUCT_CODE_SUSPICIOUS_SEC",
        message: `Product Code "${raw}" contains "${brandUpper}_SEC" which should not occur for combined brands`,
      });
    }
  }

  if (!vendorCode || !productCode) {
    return fail("PRODUCT_CODE_INVALID", `Product Code "${raw}" is missing vendorcode or productcode token`);
  }

  return ok({
    raw,
    vendorCode,
    productCode,
    brandTokenFromCode,
    isSecondary,
    issues,
  });
}


