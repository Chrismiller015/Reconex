import type { ChipProps } from "@mui/material/Chip";

export type ReconFlagCode =
  | "TERMINATED_BAC"
  | "MISSING_ON_GM"
  | "MISSING_ON_DI"
  | "GM_DUPLICATES"
  | "GM_NON_BILLING_ROWS_PRESENT"
  | "GM_DESYNC_DETECTED"
  | "DI_NON_BILLABLE_ROWS_PRESENT"
  | "BRAND_MISMATCH"
  | "PRICING_MISMATCH"
  | "HAS_REMOVED"
  | "STATUS_MISMATCH"
  | "EXCLUDED"
  | "NON_BILLABLE"
  | "VARIANCE";

type FlagMeta = {
  label: string;
  /** MUI Chip color */
  color?: ChipProps["color"];
  /** MUI Chip variant */
  variant?: ChipProps["variant"];
};

type FlagDescription = {
  title: string;
  description: string;
};

const FLAG_META: Partial<Record<ReconFlagCode, FlagMeta>> = {
  VARIANCE: { label: "Variance", color: "error", variant: "filled" },

  // "Big" problems
  MISSING_ON_GM: { label: "Missing on GM", color: "error", variant: "outlined" },
  MISSING_ON_DI: { label: "Missing on DI", color: "error", variant: "outlined" },
  PRICING_MISMATCH: { label: "Pricing mismatch", color: "error", variant: "outlined" },

  // Warnings
  STATUS_MISMATCH: { label: "Status mismatch", color: "warning", variant: "filled" },
  EXCLUDED: { label: "Excluded", color: "warning", variant: "filled" },
  NON_BILLABLE: { label: "Non billable", color: "default", variant: "outlined" },
  BRAND_MISMATCH: { label: "Brand mismatch", color: "warning", variant: "outlined" },
  GM_DUPLICATES: { label: "GM duplicates", color: "warning", variant: "outlined" },
  GM_NON_BILLING_ROWS_PRESENT: { label: "Non billable", color: "default", variant: "outlined" },
  DI_NON_BILLABLE_ROWS_PRESENT: { label: "Non billable", color: "default", variant: "outlined" },

  // Informational
  GM_DESYNC_DETECTED: { label: "Billing desync", color: "info", variant: "outlined" },
  TERMINATED_BAC: { label: "Terminated BAC", color: "info", variant: "outlined" },
  HAS_REMOVED: { label: "Has removed items", color: "info", variant: "outlined" },
};

const FLAG_DESCRIPTIONS: Partial<Record<ReconFlagCode, FlagDescription>> = {
  VARIANCE: {
    title: "Variance",
    description: "Dollar mismatch (Δ outside tolerance) for this item/BAC after applying removals and exclusions.",
  },
  STATUS_MISMATCH: {
    title: "Status mismatch",
    description: "DI and GM have different statuses for this product (e.g. live vs pending live).",
  },
  EXCLUDED: {
    title: "Excluded",
    description: "This row is excluded from totals (e.g. not billing / non-billable / terminated BAC / invalid value).",
  },
  NON_BILLABLE: {
    title: "Non billable",
    description: "This row/item is non-billable and excluded from totals (GM Is Billing=false or DI non-billable status).",
  },
  MISSING_ON_GM: {
    title: "Missing on GM",
    description: "Present on DI (included in totals) but missing on GM (included in totals).",
  },
  MISSING_ON_DI: {
    title: "Missing on DI",
    description: "Present on GM (included in totals) but missing on DI (included in totals).",
  },
  GM_DUPLICATES: {
    title: "GM duplicates",
    description: "GM contains multiple rows for the same BAC / brand / product code combination.",
  },
  GM_NON_BILLING_ROWS_PRESENT: {
    title: "Non billable",
    description: "At least one GM row is non-billable (Is Billing = false) and is excluded from GM totals.",
  },
  GM_DESYNC_DETECTED: {
    title: "Billing desync",
    description: "GM Is Billing does not match what we'd expect based on status + effective date (potential upstream issue).",
  },
  DI_NON_BILLABLE_ROWS_PRESENT: {
    title: "Non billable",
    description: "At least one DI row is excluded due to non-billable status, so it is excluded from DI totals.",
  },
  BRAND_MISMATCH: {
    title: "Brand mismatch",
    description: "GM Product Brand does not match the brand token inferred from the product code.",
  },
  PRICING_MISMATCH: {
    title: "Pricing mismatch",
    description: "Observed DI/GM pricing does not match the expected price computed from the pricing table rules.",
  },
  TERMINATED_BAC: {
    title: "Terminated BAC",
    description: "BAC is terminated on GM; DI totals are treated as 0 for comparison purposes.",
  },
  HAS_REMOVED: {
    title: "Has removed items",
    description: "At least one item in this BAC was marked removed by a user and is excluded from totals.",
  },
};

function titleCaseFromConstant(input: string): string {
  return input
    .split("_")
    .filter(Boolean)
    .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

export function flagChipProps(code: string): FlagMeta & { raw: string } {
  const meta = FLAG_META[code as ReconFlagCode];
  if (meta) return { ...meta, raw: code };

  return {
    label: titleCaseFromConstant(code),
    color: "default",
    variant: "outlined",
    raw: code,
  };
}

export function flagDescription(code: string): FlagDescription {
  const meta = FLAG_DESCRIPTIONS[code as ReconFlagCode];
  if (meta) return meta;
  const title = flagChipProps(code).label;
  return { title, description: "No description available." };
}

export function flagSeverity(code: string): number {
  const meta = FLAG_META[code as ReconFlagCode];
  const color = meta?.color ?? "default";
  if (color === "error") return 3;
  if (color === "warning") return 2;
  if (color === "info") return 1;
  return 0;
}

export function worstFlagCode(codes: string[]): string | null {
  if (codes.length === 0) return null;
  let worst = codes[0]!;
  let worstScore = flagSeverity(worst);
  for (const c of codes.slice(1)) {
    const score = flagSeverity(c);
    if (score > worstScore) {
      worst = c;
      worstScore = score;
    }
  }
  return worst;
}

