import { parseProductCode } from "@/lib/recon/productCode";

describe("parseProductCode", () => {
  it("parses primary product codes", () => {
    const res = parseProductCode("DI_P1_C");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.vendorCode).toBe("DI");
    expect(res.value.productCode).toBe("P1");
    expect(res.value.brandTokenFromCode).toBe("C");
    expect(res.value.isSecondary).toBe(false);
    expect(res.value.issues).toEqual([]);
  });

  it("parses secondary product codes", () => {
    const res = parseProductCode("DI_P1_CAD_SEC");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.isSecondary).toBe(true);
    expect(res.value.brandTokenFromCode).toBe("CAD");
  });

  it("flags suspicious combined-brand SEC", () => {
    const res = parseProductCode("DI_P1_CB_SEC");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.isSecondary).toBe(true);
    expect(res.value.issues.some((i) => i.code === "PRODUCT_CODE_SUSPICIOUS_SEC")).toBe(true);
  });

  it("rejects invalid token counts or suffixes", () => {
    expect(parseProductCode("A_B").ok).toBe(false);
    expect(parseProductCode("A_B_C_D_E").ok).toBe(false);
    expect(parseProductCode("A_B_C_X").ok).toBe(false);
  });

  it("is tolerant of leading/trailing whitespace but rejects empty tokens", () => {
    expect(parseProductCode("  DI_P1_C  ").ok).toBe(true);
    expect(parseProductCode("DI__P1__C").ok).toBe(true); // empty tokens are dropped; still parseable
    expect(parseProductCode("___").ok).toBe(false);
  });
});


