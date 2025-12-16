import { normalizeIsBilling, normalizeIsTerminated } from "@/lib/recon/booleans";

describe("normalizeIsBilling", () => {
  it("accepts truthy variants", () => {
    const truthy = ["TRUE", "billing", "Is Billing", "1", " isbilling "];
    for (const input of truthy) {
      const res = normalizeIsBilling(input);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe(true);
    }
  });

  it("accepts falsy variants", () => {
    const falsy = ["FALSE", "not billing", "NOTBILLING", "0", "", "   "];
    for (const input of falsy) {
      const res = normalizeIsBilling(input);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe(false);
    }
  });

  it("rejects unknown variants", () => {
    expect(normalizeIsBilling("maybe").ok).toBe(false);
  });
});

describe("normalizeIsTerminated", () => {
  it("treats blank as N", () => {
    const res1 = normalizeIsTerminated("");
    expect(res1.ok).toBe(true);
    if (res1.ok) expect(res1.value).toBe(false);

    const res2 = normalizeIsTerminated(" ");
    expect(res2.ok).toBe(true);
    if (res2.ok) expect(res2.value).toBe(false);
  });

  it("accepts Y/N", () => {
    const y = normalizeIsTerminated("Y");
    expect(y.ok).toBe(true);
    if (y.ok) expect(y.value).toBe(true);

    const n = normalizeIsTerminated("n");
    expect(n.ok).toBe(true);
    if (n.ok) expect(n.value).toBe(false);
  });

  it("rejects unknown", () => {
    expect(normalizeIsTerminated("YES").ok).toBe(false);
  });
});



