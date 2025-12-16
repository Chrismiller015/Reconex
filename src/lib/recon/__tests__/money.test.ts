import Decimal from "decimal.js";
import { MONEY_TOLERANCE, parseMoney, withinMoneyTolerance } from "@/lib/recon/money";

describe("parseMoney", () => {
  it("parses numbers and strings with commas/currency", () => {
    const cases: Array<[unknown, string]> = [
      [10, "10"],
      ["10.25", "10.25"],
      ["$1,234.50", "1234.5"],
      ["-5.01", "-5.01"],
      ["  $ 1,234.50  ", "1234.5"],
      ["+12.00", "12"],
      ["0", "0"],
    ];

    for (const [input, expected] of cases) {
      const res = parseMoney(input);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value.toString()).toBe(new Decimal(expected).toString());
    }
  });

  it("parses accounting negatives in parentheses", () => {
    const res = parseMoney("($1,234.50)");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.toFixed(2)).toBe("-1234.50");
  });

  it("rejects invalid inputs", () => {
    expect(parseMoney("").ok).toBe(false);
    expect(parseMoney("abc").ok).toBe(false);
    expect(parseMoney("NaN").ok).toBe(false);
    expect(parseMoney(null).ok).toBe(false);
    expect(parseMoney(undefined).ok).toBe(false);
    expect(parseMoney({}).ok).toBe(false);
    expect(parseMoney("$$1").ok).toBe(false);
    expect(parseMoney("#DIV/0!").ok).toBe(false);
  });
});

describe("withinMoneyTolerance", () => {
  it("uses $0.01 tolerance by default", () => {
    expect(withinMoneyTolerance(new Decimal("1.00"), new Decimal("1.009"))).toBe(true);
    expect(withinMoneyTolerance(new Decimal("1.00"), new Decimal("1.02"), MONEY_TOLERANCE)).toBe(false);
  });
});



