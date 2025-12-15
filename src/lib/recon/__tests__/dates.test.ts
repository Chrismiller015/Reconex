import { expectedBillableForGmDesyncFlag, parseDiEffectiveDate, parseGmEffectiveDate, utcTodayStart } from "@/lib/recon/dates";

describe("date parsing", () => {
  it("parses GM effective date ISO and normalizes to UTC day start", () => {
    const res = parseGmEffectiveDate("2025-11-30T00:00Z");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.toISOString()).toBe("2025-11-30T00:00:00.000Z");
  });

  it("parses DI effectiveDate MM/DD/YYYY", () => {
    const res = parseDiEffectiveDate("12/11/2025");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.toISOString()).toBe("2025-12-11T00:00:00.000Z");
  });

  it("trims whitespace and rejects invalid calendar dates", () => {
    expect(parseDiEffectiveDate(" 12/11/2025 ").ok).toBe(true);
    const bad = ["02/30/2025", "13/01/2025", "00/10/2025", "12/00/2025", "12-11-2025", "", "   "];
    for (const input of bad) {
      expect(parseDiEffectiveDate(input).ok).toBe(false);
    }
  });

  it("rejects non-ISO GM date strings", () => {
    expect(parseGmEffectiveDate("not-a-date").ok).toBe(false);
    expect(parseGmEffectiveDate("").ok).toBe(false);
    expect(parseGmEffectiveDate("   ").ok).toBe(false);
  });
});

describe("expectedBillableForGmDesyncFlag", () => {
  const now = new Date("2025-12-14T12:00:00.000Z");
  const todayStart = utcTodayStart(now);

  it("treats pending live/live as expected billable iff effective date is on/before TODAY (UTC)", () => {
    expect(expectedBillableForGmDesyncFlag("live", new Date("2025-12-13T00:00:00.000Z"), now)).toBe(true);
    expect(expectedBillableForGmDesyncFlag("live", todayStart, now)).toBe(true);
    expect(expectedBillableForGmDesyncFlag("pending live", new Date("2025-12-15T00:00:00.000Z"), now)).toBe(false);
  });

  it("treats pending cancel/cancelled as expected billable iff effective date is after TODAY (UTC)", () => {
    expect(expectedBillableForGmDesyncFlag("pending cancel", new Date("2025-12-15T00:00:00.000Z"), now)).toBe(true);
    expect(expectedBillableForGmDesyncFlag("pending cancel", todayStart, now)).toBe(false);
    expect(expectedBillableForGmDesyncFlag("cancelled", new Date("2025-12-13T00:00:00.000Z"), now)).toBe(false);
  });
});


