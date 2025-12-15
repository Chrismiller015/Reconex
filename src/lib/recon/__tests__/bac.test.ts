import { normalizeBac } from "@/lib/recon/bac";

describe("normalizeBac", () => {
  it("pads to 6 digits and preserves leading zeros", () => {
    const res1 = normalizeBac("123");
    expect(res1.ok).toBe(true);
    if (res1.ok) expect(res1.value).toBe("000123");

    const res2 = normalizeBac("001234");
    expect(res2.ok).toBe(true);
    if (res2.ok) expect(res2.value).toBe("001234");
  });

  it("handles whitespace and separators by extracting digits", () => {
    expect(normalizeBac(" 123 ").ok).toBe(true);
    const res = normalizeBac("12-3");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe("000123");
  });

  it("rejects non-digit and oversized values", () => {
    expect(normalizeBac("").ok).toBe(false);
    expect(normalizeBac("abc").ok).toBe(false);
    expect(normalizeBac("1234567").ok).toBe(false);
  });
});


