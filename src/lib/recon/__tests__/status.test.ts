import { isBillableDiStatus, normalizeStatus } from "@/lib/recon/status";

describe("normalizeStatus", () => {
  it("normalizes casing/spacing and canceled/cancelled", () => {
    const cases: Array<[string, string]> = [
      ["Live", "live"],
      [" pending   live ", "pending live"],
      ["pending cancel", "pending cancel"],
      ["Canceled", "cancelled"],
      ["cancelled", "cancelled"],
      ["PENDING    CANCEL", "pending cancel"],
    ];

    for (const [input, expected] of cases) {
      const res = normalizeStatus(input);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe(expected);
    }
  });

  it("rejects unknown statuses", () => {
    expect(normalizeStatus("unknown").ok).toBe(false);
    expect(normalizeStatus("").ok).toBe(false);
    expect(normalizeStatus("   ").ok).toBe(false);
  });
});

describe("isBillableDiStatus", () => {
  it("matches DI inclusion rules", () => {
    expect(isBillableDiStatus("live")).toBe(true);
    expect(isBillableDiStatus("pending cancel")).toBe(true);
    expect(isBillableDiStatus("pending live")).toBe(false);
    expect(isBillableDiStatus("cancelled")).toBe(false);
  });
});



