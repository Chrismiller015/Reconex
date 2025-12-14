import Decimal from "decimal.js";
import { runCompareEngine } from "@/lib/recon/compareEngine";
import type { DiRowNormalized, GmRowNormalized } from "@/lib/recon/rows";

function diRow(overrides: Partial<DiRowNormalized> & Pick<DiRowNormalized, "bac" | "brandToken" | "productCode">): DiRowNormalized {
  return {
    source: "DI",
    raw: {},
    status: "live",
    effectiveDateUtc: new Date("2025-01-01T00:00:00.000Z"),
    dealerPrice: new Decimal(0),
    isIncludedInTotals: true,
    exclusionReasons: [],
    ...overrides,
  };
}

function gmRow(overrides: Partial<GmRowNormalized> & Pick<GmRowNormalized, "bac" | "productBrand" | "productCode">): GmRowNormalized {
  return {
    source: "GM",
    raw: {},
    status: "live",
    effectiveDateUtc: new Date("2025-01-01T00:00:00.000Z"),
    dealerCost: new Decimal(0),
    isBilling: true,
    isTerminatedBac: false,
    expectedBillableForDesync: true,
    isDesync: false,
    isIncludedInTotals: true,
    exclusionReasons: [],
    issues: [],
    productCodeBrandToken: null,
    ...overrides,
  };
}

describe("runCompareEngine", () => {
  it("flags missing side as variance and treats missing total as $0", () => {
    const di: DiRowNormalized[] = [diRow({ bac: "000123", brandToken: "C", productCode: "DI_P1_C", dealerPrice: new Decimal(10) })];
    const gm: GmRowNormalized[] = [];

    const res = runCompareEngine(di, gm);
    expect(res.bacSummaries).toHaveLength(1);
    expect(res.bacSummaries[0].bac).toBe("000123");
    expect(res.bacSummaries[0].flags).toContain("MISSING_ON_GM");
    expect(res.bacSummaries[0].gmTotal.toString()).toBe("0");
    expect(res.bacSummaries[0].diTotal.toString()).toBe("10");
  });

  it("flags terminated BAC and excludes it from totals (both sides)", () => {
    const di: DiRowNormalized[] = [diRow({ bac: "000200", brandToken: "C", productCode: "DI_P1_C", dealerPrice: new Decimal(99) })];
    const gm: GmRowNormalized[] = [
      gmRow({
        bac: "000200",
        productBrand: "C",
        productCode: "DI_P1_C",
        dealerCost: new Decimal(99),
        isTerminatedBac: true,
        isIncludedInTotals: false,
        exclusionReasons: ["TERMINATED_BAC"],
      }),
    ];

    const res = runCompareEngine(di, gm);
    expect(res.bacSummaries).toHaveLength(1);
    expect(res.bacSummaries[0].flags).toContain("TERMINATED_BAC");
    expect(res.bacSummaries[0].diTotal.toString()).toBe("0");
    expect(res.bacSummaries[0].gmTotal.toString()).toBe("0");
  });

  it("flags GM duplicates for (BAC, Product Brand, Product Code)", () => {
    const gm: GmRowNormalized[] = [
      gmRow({ bac: "000300", productBrand: "C", productCode: "DI_P1_C", dealerCost: new Decimal(5) }),
      gmRow({ bac: "000300", productBrand: "C", productCode: "DI_P1_C", dealerCost: new Decimal(5) }),
    ];
    const di: DiRowNormalized[] = [diRow({ bac: "000300", brandToken: "C", productCode: "DI_P1_C", dealerPrice: new Decimal(10) })];

    const res = runCompareEngine(di, gm);
    expect(res.bacSummaries).toHaveLength(1);
    expect(res.bacSummaries[0].flags).toContain("GM_DUPLICATES");
  });

  it("flags DI non-billable rows present even if totals match", () => {
    const di: DiRowNormalized[] = [
      diRow({ bac: "000400", brandToken: "C", productCode: "DI_P1_C", dealerPrice: new Decimal(10) }),
      diRow({
        bac: "000400",
        brandToken: "C",
        productCode: "DI_P2_C",
        status: "pending live",
        dealerPrice: new Decimal(123),
        isIncludedInTotals: false,
        exclusionReasons: ["NON_BILLABLE_STATUS"],
      }),
    ];
    const gm: GmRowNormalized[] = [gmRow({ bac: "000400", productBrand: "C", productCode: "DI_P1_C", dealerCost: new Decimal(10) })];

    const res = runCompareEngine(di, gm);
    expect(res.bacSummaries).toHaveLength(1);
    expect(res.bacSummaries[0].flags).toContain("DI_NON_BILLABLE_ROWS_PRESENT");
  });
});

