import { parse as csvParse } from "csv-parse";
import { Readable } from "node:stream";
import * as XLSX from "xlsx";
import { detectSchemaFromHeaders, type DetectedSchemaType } from "@/lib/recon/schemas";

export type UploadMetadata = {
  headers: string[];
  rowCount: number;
  detectedSchema: DetectedSchemaType;
  missingFields: { gm: string[]; di: string[] };
  detectedMimeType?: string;
  detectedFileExt?: string;
};

function getStringHeadersFromRow(row: unknown[]): string[] {
  return row.map((cell) => String(cell ?? "").trim()).filter((h) => h.length > 0);
}

export async function parseCsvMetadata(buffer: Buffer): Promise<{ headers: string[]; rowCount: number }> {
  return await new Promise((resolve, reject) => {
    let headers: string[] = [];
    let rowCount = 0;

    const parser = csvParse({
      columns: (cols: string[]) => {
        headers = cols.map((c: unknown) => String(c ?? ""));
        return cols;
      },
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });

    parser.on("readable", () => {
      while (parser.read() !== null) {
        rowCount += 1;
      }
    });
    parser.on("error", reject);
    parser.on("end", () => resolve({ headers, rowCount }));

    Readable.from(buffer).pipe(parser);
  });
}

export async function parseExcelMetadata(buffer: Buffer): Promise<{ headers: string[]; rowCount: number }> {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) {
    throw new Error("Excel workbook contained no sheets");
  }

  // Choose the sheet whose first row best matches our expected schemas (fewest missing headers).
  let bestSheetName = sheetNames[0];
  let bestMissingCount = Number.POSITIVE_INFINITY;

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, range: 0, blankrows: false }) as unknown[][];
    const headerRow = rows[0] ?? [];
    const headersCandidate = getStringHeadersFromRow(headerRow);
    const detection = detectSchemaFromHeaders(headersCandidate);
    const missingCount = Math.min(detection.missing.gm.length, detection.missing.di.length);
    if (missingCount < bestMissingCount) {
      bestMissingCount = missingCount;
      bestSheetName = name;
    }
  }

  const sheet = workbook.Sheets[bestSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false }) as unknown[][];
  const headers = getStringHeadersFromRow(rows[0] ?? []);
  if (headers.length === 0) {
    throw new Error("Excel workbook contained no header row");
  }
  const dataRows = rows.slice(1);
  const rowCount = dataRows.filter((r) => r.some((cell) => String(cell ?? "").trim().length > 0)).length;

  return { headers, rowCount };
}

export async function computeUploadMetadata(
  buffer: Buffer,
  extension: string,
): Promise<UploadMetadata> {
  const detected = sniffType(buffer, extension);

  let parsed: { headers: string[]; rowCount: number };
  if (extension === "csv") {
    parsed = await parseCsvMetadata(buffer);
  } else {
    // XLSX/XLSM/XLSB should be ZIP containers; reject obviously-invalid payloads early.
    if (!detected) {
      throw new Error("File does not look like a valid Excel workbook (expected ZIP/PK header)");
    }
    parsed = await parseExcelMetadata(buffer);
  }

  const detection = detectSchemaFromHeaders(parsed.headers);
  const detectedSchema = detection.schemaType === "AMBIGUOUS" ? "UNKNOWN" : detection.schemaType;

  return {
    headers: parsed.headers,
    rowCount: parsed.rowCount,
    detectedSchema,
    missingFields: detection.missing,
    detectedMimeType: detected?.mime,
    detectedFileExt: detected?.ext,
  };
}

function sniffType(buffer: Buffer, extension: string): { mime: string; ext: string } | undefined {
  // Basic, dependency-free sniffing. We treat this as informational only.
  if (extension === "csv") {
    const sample = buffer.subarray(0, 1024).toString("utf8");
    if (sample.includes(",") || sample.includes("\n")) return { mime: "text/csv", ext: "csv" };
    return { mime: "text/plain", ext: "csv" };
  }

  // XLSX/XLSM/XLSB are zip containers that typically start with PK.
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return {
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ext: extension,
    };
  }

  return undefined;
}



