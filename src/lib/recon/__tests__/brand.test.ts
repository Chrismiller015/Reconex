import { normalizeBrandToken } from "@/lib/recon/brand";

describe("normalizeBrandToken", () => {
  it("normalizes GM raw values and permutations", () => {
    const cases: Array<[string, string]> = [
      ["c", "C"],
      ["B", "B"],
      [" g ", "G"],
      ["bg", "BG"],
      ["gb", "BG"],
      ["k", "CAD"],
      ["cad", "CAD"],
      ["bc", "CB"],
      ["cb", "CB"],
      ["gc", "CG"],
      ["cg", "CG"],
      ["bcg", "CBG"],
      ["gcb", "CBG"],
      ["cbg", "CBG"],
    ];

    for (const [input, expected] of cases) {
      const res = normalizeBrandToken(input);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe(expected);
    }
  });

  it("rejects invalid values", () => {
    const bad = ["", " ", "CA", "Z", "BGCX", "CC", "KAD"];
    for (const input of bad) {
      const res = normalizeBrandToken(input);
      expect(res.ok).toBe(false);
    }
  });
});


