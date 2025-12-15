import { parsePricingTableCsv } from "@/lib/pricing/pricingTableDb";

const header =
  `"Product Code","Pricing Table ID (18 Digit)","Active","DI Brand Name","Website Tier","Invoice Group","Dealer Price Currency","Dealer Price","OEM Product Code"\n`;

describe("parsePricingTableCsv", () => {
  it("dedupes duplicate (Product Code, Website Tier) by keeping the single ACTIVE row", () => {
    const csv =
      header +
      `"MANAGED-SERVICES-STAND","id1","0","Old","","GM_Alacarte","USD","500.00","DI_MSSP_"\n` +
      `"MANAGED-SERVICES-STAND","id2","1","New","","GM_Alacarte","USD","500.00","DI_MSSP_"\n`;

    const parsed = parsePricingTableCsv(csv, "pricing.csv");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.pricingTableId).toBe("id2");
    expect(parsed.rows[0]!.active).toBe(true);
    expect(parsed.droppedDuplicates).toBe(1);
  });

  it("throws if a key has multiple ACTIVE rows (ambiguous)", () => {
    const csv =
      header +
      `"DIWEBPKG","id1","1","Base","DIWEB-TIER1","GM_Website","USD","1549.00","DI_B_"\n` +
      `"DIWEBPKG","id2","1","Base2","DIWEB-TIER1","GM_Website","USD","1549.00","DI_B_"\n`;

    expect(() => parsePricingTableCsv(csv, "pricing.csv")).toThrow(/multiple ACTIVE rows/i);
  });

  it("dedupes when all rows are inactive by keeping the first row deterministically", () => {
    const csv =
      header +
      `"SOME-CODE","id1","0","Old","","GM_Alacarte","USD","10.00","X"\n` +
      `"SOME-CODE","id2","0","Newer","","GM_Alacarte","USD","10.00","X"\n`;

    const parsed = parsePricingTableCsv(csv, "pricing.csv");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.pricingTableId).toBe("id1");
    expect(parsed.rows[0]!.active).toBe(false);
    expect(parsed.droppedDuplicates).toBe(1);
  });
});


