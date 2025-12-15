import { getMissingRequiredHeaders } from "@/lib/recon/headers";

export const ALLOWED_UPLOAD_EXTENSIONS = ["csv", "xlsx", "xlsm", "xlsb"] as const;
export type AllowedUploadExtension = (typeof ALLOWED_UPLOAD_EXTENSIONS)[number];

export const GM_REQUIRED_HEADERS = [
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
] as const;

export const DI_REQUIRED_HEADERS = [
  "Id",
  "BAC",
  "Account",
  "Status",
  "Dealer Price",
  "Brand Mix",
  "effectiveDate",
  "Account ID as Id",
  "OemProductCodePopcorn",
  "Product Name",
] as const;

export type DetectedSchemaType = "GM" | "DI" | "UNKNOWN" | "AMBIGUOUS";

export type SchemaDetection = {
  schemaType: DetectedSchemaType;
  missing: {
    gm: string[];
    di: string[];
  };
};

export function detectSchemaFromHeaders(headers: string[]): SchemaDetection {
  const missingGm = getMissingRequiredHeaders(headers, [...GM_REQUIRED_HEADERS]);
  const missingDi = getMissingRequiredHeaders(headers, [...DI_REQUIRED_HEADERS]);

  const gmOk = missingGm.length === 0;
  const diOk = missingDi.length === 0;

  let schemaType: DetectedSchemaType = "UNKNOWN";
  if (gmOk && diOk) schemaType = "AMBIGUOUS";
  else if (gmOk) schemaType = "GM";
  else if (diOk) schemaType = "DI";

  return { schemaType, missing: { gm: missingGm, di: missingDi } };
}


