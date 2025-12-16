import Decimal from "decimal.js";
import type { BrandToken } from "@/lib/recon/types";
import type { CanonicalStatus } from "@/lib/recon/status";

export type ExclusionReason =
  | "NON_BILLABLE_STATUS"
  | "NOT_BILLING"
  | "TERMINATED_BAC"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_VALUE";

export type DiRowNormalized = {
  source: "DI";
  raw: Record<string, unknown>;
  bac: string;
  brandToken: BrandToken;
  productCode: string;
  diProductCode: string | null;
  status: CanonicalStatus;
  effectiveDateUtc: Date;
  lastUpdatedDateUtc: Date | null;
  dealerPrice: Decimal;
  quantity: number;
  isIncludedInTotals: boolean;
  exclusionReasons: ExclusionReason[];
};

export type GmRowNormalized = {
  source: "GM";
  raw: Record<string, unknown>;
  bac: string;
  productCode: string;
  productBrand: BrandToken; // authoritative store/brand
  productCodeBrandToken: BrandToken | null; // from Product Code (may mismatch)
  status: CanonicalStatus;
  effectiveDateUtc: Date;
  lastUpdatedDateUtc: Date | null;
  dealerCost: Decimal;
  quantity: number;
  isBilling: boolean;
  isTerminatedBac: boolean;
  expectedBillableForDesync: boolean;
  isDesync: boolean;
  isIncludedInTotals: boolean;
  exclusionReasons: ExclusionReason[];
  issues: { code: string; message: string }[];
};



