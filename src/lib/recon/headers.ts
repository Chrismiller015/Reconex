export function normalizeHeaderName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export type HeaderIndex = {
  normalizedToOriginal: Map<string, string>;
  normalizedToIndex: Map<string, number>;
};

export function buildHeaderIndex(headers: string[]): HeaderIndex {
  const normalizedToOriginal = new Map<string, string>();
  const normalizedToIndex = new Map<string, number>();

  headers.forEach((header, idx) => {
    const normalized = normalizeHeaderName(header);
    if (!normalized) return;
    if (!normalizedToOriginal.has(normalized)) {
      normalizedToOriginal.set(normalized, header);
    }
    if (!normalizedToIndex.has(normalized)) {
      normalizedToIndex.set(normalized, idx);
    }
  });

  return { normalizedToOriginal, normalizedToIndex };
}

export function getMissingRequiredHeaders(headers: string[], required: string[]): string[] {
  const index = buildHeaderIndex(headers);
  const missing: string[] = [];
  for (const requiredHeader of required) {
    const key = normalizeHeaderName(requiredHeader);
    if (!index.normalizedToIndex.has(key)) missing.push(requiredHeader);
  }
  return missing;
}

