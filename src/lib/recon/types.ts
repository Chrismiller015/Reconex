export const BRAND_TOKENS = ["C", "B", "G", "BG", "CAD", "CB", "CG", "CBG"] as const;

export type BrandToken = (typeof BRAND_TOKENS)[number];

export type NormalizationIssue = {
  code: string;
  message: string;
};

export type NormalizationResult<T> =
  | { ok: true; value: T; issues?: NormalizationIssue[] }
  | { ok: false; issues: NormalizationIssue[] };

export function ok<T>(value: T, issues: NormalizationIssue[] = []): NormalizationResult<T> {
  return issues.length ? { ok: true, value, issues } : { ok: true, value };
}

export function fail(code: string, message: string): NormalizationResult<never> {
  return { ok: false, issues: [{ code, message }] };
}

