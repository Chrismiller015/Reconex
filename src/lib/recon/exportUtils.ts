import * as XLSX from "xlsx";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function toXlsxBuffer(sheets: Array<{ name: string; headers: string[]; rows: Array<Record<string, unknown>> }>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const jsonRows = sheet.rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const h of sheet.headers) out[h] = r[h];
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(jsonRows, { header: sheet.headers });
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Buffer.from(buf);
}



