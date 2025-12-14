import * as XLSX from "xlsx";
import { parseGmExcelRows } from "@/lib/recon/parseGmExcel";

describe("parseGmExcelRows edge cases", () => {
  it("marks rows with Excel formula errors as INVALID_VALUE (e.g. #DIV/0!)", async () => {
    const aoa: unknown[][] = [
      [
        "BAC",
        "Product Code",
        "Product Brand",
        "Dealer Cost",
        "Is Billing",
        "Product Status",
        "Effective Date",
        "Is Terminated",
        "IsTerminatedDate",
        "Last Updated Date",
      ],
      [
        "000123",
        "DI_P1_C",
        "C",
        "#DIV/0!",
        "TRUE",
        "live",
        "2025-12-11T00:00:00.000Z",
        "FALSE",
        "",
        "12/12/2025",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GM");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const parsed = await parseGmExcelRows(buf, new Date("2025-12-14T00:00:00.000Z"));
    expect(parsed.rowCount).toBe(1);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].exclusionReasons).toEqual(expect.arrayContaining(["INVALID_VALUE"]));
    expect(parsed.rows[0].isIncludedInTotals).toBe(false);
  });
});

