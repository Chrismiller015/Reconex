import type { UploadedFile, UploadedSchemaType } from "@prisma/client";
import { readStoredFile } from "@/lib/recon/storage";
import { parseDiCsvRows } from "@/lib/recon/parseDiCsv";
import { parseDiExcelRows } from "@/lib/recon/parseDiExcel";
import { parseGmExcelRows } from "@/lib/recon/parseGmExcel";
import { parseGmCsvRows } from "@/lib/recon/parseGmCsv";
import type { DiRowNormalized, GmRowNormalized } from "@/lib/recon/rows";

export type ParsedUpload =
  | { schemaType: "DI"; rows: DiRowNormalized[]; rowCount: number }
  | { schemaType: "GM"; rows: GmRowNormalized[]; rowCount: number };

export async function parseUploadedFileToRows(
  file: Pick<UploadedFile, "storedPath" | "extension" | "schemaType">,
  now: Date = new Date(),
): Promise<ParsedUpload> {
  const buf = await readStoredFile(file.storedPath);
  const ext = (file.extension ?? "").toLowerCase();

  if (file.schemaType === ("DI" as UploadedSchemaType)) {
    if (ext === "csv") {
      const parsed = await parseDiCsvRows(buf);
      return { schemaType: "DI", rows: parsed.rows, rowCount: parsed.rowCount };
    }
    const parsed = await parseDiExcelRows(buf);
    return { schemaType: "DI", rows: parsed.rows, rowCount: parsed.rowCount };
  }

  if (file.schemaType === ("GM" as UploadedSchemaType)) {
    if (ext === "csv") {
      const parsed = await parseGmCsvRows(buf, now);
      return { schemaType: "GM", rows: parsed.rows, rowCount: parsed.rowCount };
    }
    const parsed = await parseGmExcelRows(buf, now);
    return { schemaType: "GM", rows: parsed.rows, rowCount: parsed.rowCount };
  }

  throw new Error("Cannot parse file rows: schemaType is UNKNOWN");
}

