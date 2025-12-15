"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Box,
  Breadcrumbs,
  Button as MuiButton,
  Card,
  CardContent,
  Chip,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Popper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Link as MuiLink,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useSnackbar } from "notistack";
import { flagChipProps, flagDescription, worstFlagCode } from "@/components/runs/flagPresentation";
import CloseIcon from "@mui/icons-material/Close";
import StarterKit from "@tiptap/starter-kit";
import { env } from "@/env.mjs";
import NextLink from "next/link";
import {
  MenuButtonBold,
  MenuButtonItalic,
  MenuButtonStrikethrough,
  MenuButtonUnderline,
  MenuControlsContainer,
  MenuDivider,
  RichTextEditor,
  type RichTextEditorRef,
} from "mui-tiptap";

type DrilldownDto = {
  runId: string;
  bac: string;
  header: { gmTotal: string; diTotal: string; delta: string; flags: string[]; hasVariance: boolean };
  groups: Array<{
    id: string;
    brandToken: string;
    productCode: string;
    diAmount: string;
    gmAmount: string;
    delta: string;
    isRemoved: boolean;
    isBugged: boolean;
    category: string | null;
    status: string;
    flags: { flags?: string[]; isVariance?: boolean };
    context: {
      displayName: string | null;
      salesforce: {
        accountId: string | null;
        accountName: string | null;
        subscriptionId: string | null;
        orderItemId: string | null;
        quoteLineId: string | null;
        matchMethod: "diRow" | "diBacBrand" | "diBacAny" | "unknown";
        candidates: Array<{ accountId: string; accountName: string | null; count: number }>;
        searchHint: string;
      };
      pricing: {
        expectedUnitPrice: string;
        expectedProductCode: string;
        websiteTier: string | null;
        diBrandName: string;
        ruleLabel: string;
      } | null;
      observed: {
        diStatus: string;
        gmStatus: string;
        diEffectiveDate: string;
        gmEffectiveDate: string;
        diLastUpdated: string;
        gmLastUpdated: string;
        diQty: number;
        gmQty: number;
        diTotal: string;
        gmTotal: string;
      };
      reasons: string[];
      pricingMismatch: { di: boolean; gm: boolean };
      statusMismatch: boolean;
    };
    notesCount: number;
    notes: Array<{ id: string; noteText: string; author: string | null; createdAt: string }>;
  }>;
  diRows: Array<{
    rowKey: string;
    matchKey: string;
    productCode: string;
    brandToken: string;
    status: string;
    dealerPrice: string;
    quantity: number;
    isIncludedInTotals: boolean;
    exclusionReasons: string[];
    effectiveDateUtc: string;
    lastUpdatedDateUtc: string | null;
    orderItemId: string | null;
    raw: Record<string, unknown>;
  }>;
  gmRows: Array<{
    rowKey: string;
    matchKey: string;
    productCode: string;
    productBrand: string;
    status: string;
    dealerCost: string;
    quantity: number;
    isBilling: boolean;
    isDesync: boolean;
    isIncludedInTotals: boolean;
    exclusionReasons: string[];
    effectiveDateUtc: string;
    lastUpdatedDateUtc: string | null;
    issues: Array<{ code: string; message: string }>;
    raw: Record<string, unknown>;
  }>;
};

export function BacDrilldownView() {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const params = useParams<{ id: string; bac: string }>();
  const runId = params.id;
  const bac = params.bac;
  const router = useRouter();
  const searchParams = useSearchParams();
  const pricingMode: "run" | "latest" = searchParams.get("pricingMode") === "latest" ? "latest" : "run";
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const noteEditorRef = useRef<RichTextEditorRef>(null);

  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [categoryDraftByKey, setCategoryDraftByKey] = useState<Record<string, string>>({});
  const [removedOverrides, setRemovedOverrides] = useState<Record<string, boolean>>({});
  const [buggedOverrides, setBuggedOverrides] = useState<Record<string, boolean>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [noteDialog, setNoteDialog] = useState<{
    open: boolean;
    brandToken: string;
    productCode: string;
    noteId: string | null;
    initialContent: string;
  }>({ open: false, brandToken: "", productCode: "", noteId: null, initialContent: "" });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [flagPopover, setFlagPopover] = useState<{ anchorEl: HTMLElement | null; flags: string[] }>({
    anchorEl: null,
    flags: [],
  });
  const flagCloseTimer = useRef<number | null>(null);
  const [statusPopover, setStatusPopover] = useState<{ anchorEl: HTMLElement | null; statuses: string[] }>({
    anchorEl: null,
    statuses: [],
  });
  const statusCloseTimer = useRef<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsKey, setDetailsKey] = useState<string | null>(null);
  const [detailsRowKeys, setDetailsRowKeys] = useState<{ di: string | null; gm: string | null }>({ di: null, gm: null });
  const [productsTab, setProductsTab] = useState<0 | 1>(0);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const openDetails = useCallback((brandToken: string, productCode: string, rowKeys?: { di?: string | null; gm?: string | null }) => {
    const key = `${brandToken}::${productCode}`;
    setDetailsKey(key);
    setDetailsRowKeys({ di: rowKeys?.di ?? null, gm: rowKeys?.gm ?? null });
    setDetailsOpen(true);
  }, []);

  // Prefer env override, but default to the known Salesforce instance.
  const salesforceBaseUrl = (env.NEXT_PUBLIC_SALESFORCE_BASE_URL ?? "https://cars-commerce.lightning.force.com/").trim();

  const query = useQuery({
    queryKey: ["bac-drilldown", runId, bac, pricingMode],
    queryFn: async (): Promise<DrilldownDto> => {
      const res = await fetch(`/api/runs/${runId}/bacs/${bac}?pricingMode=${encodeURIComponent(pricingMode)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load drilldown");
      return await res.json();
    },
  });

  const statusesQuery = useQuery({
    queryKey: ["settings", "workflow-statuses"],
    queryFn: async (): Promise<Array<{ id: string; name: string; sortOrder: number; isClosed: boolean; color: string | null }>> => {
      const res = await fetch("/api/settings/workflow-statuses", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load statuses");
      return await res.json();
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["settings", "note-templates"],
    queryFn: async (): Promise<Array<{ id: string; name: string; content: string }>> => {
      const res = await fetch("/api/settings/note-templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load note templates");
      return await res.json();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (payload: { bac: string; brandToken: string; productCode: string; isRemoved: boolean }) => {
      const res = await fetch(`/api/runs/${runId}/groups/remove`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to update removal");
      return json;
    },
    onSuccess: async (_data, variables) => {
      const key = `${variables.brandToken}::${variables.productCode}`;
      setRemovedOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to update removal", { variant: "error" }),
  });

  const buggedMutation = useMutation({
    mutationFn: async (payload: { bac: string; brandToken: string; productCode: string; isBugged: boolean }) => {
      const res = await fetch(`/api/runs/${runId}/groups/bugged`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to update bugged state");
      return json;
    },
    onSuccess: async (_data, variables) => {
      const key = `${variables.brandToken}::${variables.productCode}`;
      setBuggedOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to update bugged state", { variant: "error" }),
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { bac: string; brandToken: string; productCode: string; status: string }) => {
      const res = await fetch(`/api/runs/${runId}/groups/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to update status");
      return json;
    },
    onSuccess: async (_data, variables) => {
      const key = `${variables.brandToken}::${variables.productCode}`;
      setStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to update status", { variant: "error" }),
  });

  const bulkMutation = useMutation({
    mutationFn: async (payload: {
      bac: string;
      items: Array<{ brandToken: string; productCode: string }>;
      patch: { isRemoved?: boolean; isBugged?: boolean; category?: string | null; status?: string };
    }) => {
      const res = await fetch(`/api/runs/${runId}/groups/bulk-update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Bulk update failed");
      return json as { ok: boolean; updatedCount: number; auditCount: number };
    },
    onSuccess: async (data) => {
      enqueueSnackbar(`Updated ${data.updatedCount} item(s)`, { variant: "success" });
      setRowSelection({});
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Bulk update failed", { variant: "error" }),
  });

  const undoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/runs/${runId}/audit/undo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bac }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Undo failed");
      return json as { ok: boolean };
    },
    onSuccess: async () => {
      enqueueSnackbar("Undid last change", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Undo failed", { variant: "error" }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/runs/${runId}/bacs/${bac}/reset`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Reset failed");
      return json as { ok: boolean; updatedCount: number };
    },
    onSuccess: async (data) => {
      enqueueSnackbar(`Reset ${data.updatedCount} item(s)`, { variant: "success" });
      setRowSelection({});
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Reset failed", { variant: "error" }),
  });

  const categoryMutation = useMutation({
    mutationFn: async (payload: { bac: string; brandToken: string; productCode: string; category: string | null }) => {
      const res = await fetch(`/api/runs/${runId}/groups/category`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to update category");
      return json;
    },
    onSuccess: async () => {
      enqueueSnackbar("Category saved", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to update category", { variant: "error" }),
  });

  const noteCreateMutation = useMutation({
    mutationFn: async (payload: { bac: string; brandToken: string; productCode: string; noteText: string }) => {
      const res = await fetch(`/api/runs/${runId}/groups/note`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to add note");
      return json;
    },
    onSuccess: async () => {
      enqueueSnackbar("Note added", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to add note", { variant: "error" }),
  });

  const noteUpdateMutation = useMutation({
    mutationFn: async (payload: { noteId: string; noteText: string }) => {
      const res = await fetch(`/api/runs/${runId}/groups/note`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to update note");
      return json;
    },
    onSuccess: async () => {
      enqueueSnackbar("Note updated", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to update note", { variant: "error" }),
  });

  const noteDeleteMutation = useMutation({
    mutationFn: async (payload: { noteId: string }) => {
      const res = await fetch(`/api/runs/${runId}/groups/note`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete note");
      return json;
    },
    onSuccess: async () => {
      enqueueSnackbar("Note deleted", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["bac-drilldown", runId, bac] });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to delete note", { variant: "error" }),
  });

  const data = query.data;

  const brandTokenLabel = (token: string): string => {
    switch (token) {
      case "C":
        return "Chevrolet";
      case "B":
        return "Buick";
      case "G":
        return "GMC";
      case "BG":
        return "Buick/GMC";
      case "CB":
        return "Chevrolet/Buick";
      case "CG":
        return "Chevrolet/GMC";
      case "CBG":
        return "Chevrolet/Buick/GMC";
      case "CAD":
        return "CAD";
      default:
        return token;
    }
  };

  const formatBrandSet = (tokens: string[]): string => {
    const unique = Array.from(new Set(tokens.map((t) => t.trim()).filter(Boolean)));
    // Prefer stable ordering by human label, then token.
    unique.sort((a, b) => brandTokenLabel(a).localeCompare(brandTokenLabel(b)) || a.localeCompare(b));
    return unique.map(brandTokenLabel).join(", ");
  };

  const exclusionLabel = (code: string): string | null => {
    if (code === "NON_BILLABLE_STATUS") return "Non billable";
    if (code === "NOT_BILLING") return "Non billable";
    if (code === "TERMINATED_BAC") return "Terminated BAC";
    return code;
  };

  const shouldShowFlag = useCallback((code: string): boolean => {
    // Keep the grid readable by hiding high-noise flags.
    if (code === "GM_NON_BILLING_ROWS_PRESENT") return false;
    if (code === "DI_NON_BILLABLE_ROWS_PRESENT") return false;
    return true;
  }, []);

  const legendCodes = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();

    // Any group-level flags present.
    for (const g of data.groups ?? []) {
      for (const f of g.flags?.flags ?? []) {
        if (f === "GM_NON_BILLING_ROWS_PRESENT" || f === "DI_NON_BILLABLE_ROWS_PRESENT") set.add("NON_BILLABLE");
        else set.add(f);
      }
      if (g.flags?.isVariance) set.add("VARIANCE");
      if (g.isRemoved) set.add("HAS_REMOVED");
      if (g.isBugged) set.add("DPE_BUGGED");
      if (g.context?.statusMismatch) set.add("STATUS_MISMATCH");
    }

    // Exclusion badges from DI/GM row cards.
    if ((data.diRows ?? []).some((r) => !r.isIncludedInTotals)) set.add("EXCLUDED");
    if ((data.gmRows ?? []).some((r) => !r.isIncludedInTotals)) set.add("EXCLUDED");
    if ((data.gmRows ?? []).some((r) => (r.exclusionReasons ?? []).includes("NOT_BILLING"))) set.add("NON_BILLABLE");
    if ((data.diRows ?? []).some((r) => (r.exclusionReasons ?? []).includes("NON_BILLABLE_STATUS"))) set.add("NON_BILLABLE");

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const varianceGroups = useMemo(() => {
    if (!data) return [];
    return (data.groups ?? []).filter((g) => Boolean(g.flags?.isVariance));
  }, [data]);

  const groupColumns = useMemo<MRT_ColumnDef<DrilldownDto["groups"][number]>[]>(
    () => [
      { accessorKey: "brandToken", header: "Brand", size: 80 },
      {
        accessorKey: "productCode",
        header: "Product Code",
        size: 220,
        Cell: ({ row }) => {
          const displayName = row.original.context?.displayName ?? null;
          const pricing = row.original.context?.pricing ?? null;
          const titleParts: string[] = [];
          if (displayName) titleParts.push(displayName);
          if (pricing) titleParts.push(`Expected: $${pricing.expectedUnitPrice} (${pricing.expectedProductCode}${pricing.websiteTier ? `, ${pricing.websiteTier}` : ""})`);
          const title = titleParts.length ? titleParts.join("\n") : row.original.productCode;
          return (
            <Tooltip title={<pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{title}</pre>} arrow enterDelay={350}>
              <Typography variant="body2" sx={{ cursor: "help" }}>
                {row.original.productCode}
              </Typography>
            </Tooltip>
          );
        },
      },
      { accessorKey: "diAmount", header: "DI", size: 100 },
      { accessorKey: "gmAmount", header: "GM", size: 100 },
      { accessorKey: "delta", header: "Δ", size: 100 },
      {
        header: "Flags",
        accessorKey: "flags",
        size: 220,
        Cell: ({ row }) => {
          const rawFlags = (row.original.flags?.flags ?? []).filter(shouldShowFlag);
          const codes = [...rawFlags];
          if (row.original.flags?.isVariance) codes.push("VARIANCE");

          const unique = Array.from(new Set(codes));
          const worst = worstFlagCode(unique);
          const worstMeta = worst ? flagChipProps(worst) : null;

          const count = unique.length;
          const key = `${row.original.brandToken}::${row.original.productCode}`;

          return (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Chip
                size="small"
                label={count}
                color={worstMeta?.color ?? "default"}
                variant={worstMeta?.variant ?? "outlined"}
                sx={{ minWidth: 34, justifyContent: "center", fontWeight: 700 }}
                data-testid={`flags-count-${key}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isMobile) return;
                  setFlagPopover((prev) => {
                    // Toggle on mobile if clicking same anchor.
                    if (prev.anchorEl === e.currentTarget) return { anchorEl: null, flags: [] };
                    return { anchorEl: e.currentTarget, flags: unique };
                  });
                }}
                onMouseEnter={(e) => {
                  if (isMobile) return;
                  if (flagCloseTimer.current) {
                    window.clearTimeout(flagCloseTimer.current);
                    flagCloseTimer.current = null;
                  }
                  setFlagPopover((prev) => {
                    if (prev.anchorEl === e.currentTarget && prev.flags.length === unique.length) return prev;
                    return { anchorEl: e.currentTarget, flags: unique };
                  });
                }}
                onMouseLeave={() => {
                  if (isMobile) return;
                  if (flagCloseTimer.current) window.clearTimeout(flagCloseTimer.current);
                  flagCloseTimer.current = window.setTimeout(() => {
                    setFlagPopover({ anchorEl: null, flags: [] });
                    flagCloseTimer.current = null;
                  }, 120);
                }}
              />
            </Box>
          );
        },
      },
      {
        header: "Status",
        size: 180,
        Cell: ({ row }) => {
          const g = row.original;
          const key = `${g.brandToken}::${g.productCode}`;
          const value = statusOverrides[key] ?? g.status ?? "Open";
          const options = (statusesQuery.data ?? [])
            .slice()
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
            .map((s) => s.name);
          const safeOptions = options.length ? options : ["Open", "Investigating", "Blocked", "Closed", "Resolved", "Archived"];
          const resolvedValue = safeOptions.includes(value) ? value : safeOptions[0]!;
          return (
            <TextField
              select
              size="small"
              value={resolvedValue}
              inputProps={{ "data-testid": `status-select-${g.brandToken}-${g.productCode}` }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                const next = String(e.target.value);
                setStatusOverrides((prev) => ({ ...prev, [key]: next }));
                statusMutation.mutate({ bac, brandToken: g.brandToken, productCode: g.productCode, status: next });
              }}
              sx={{ minWidth: 150 }}
            >
              {safeOptions.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
          );
        },
      },
      {
        header: "Bugged",
        size: 110,
        Cell: ({ row }) => {
          const g = row.original;
          const key = `${g.brandToken}::${g.productCode}`;
          const testKey = `${g.brandToken}-${g.productCode}`;
          const checked = buggedOverrides[key] ?? g.isBugged;
          return (
            <FormControlLabel
              data-testid={`bugged-toggle-${testKey}`}
              onClick={(e) => e.stopPropagation()}
              control={
                <Switch
                  size="small"
                  checked={checked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    const nextChecked = e.target.checked;
                    setBuggedOverrides((prev) => ({ ...prev, [key]: nextChecked }));
                    buggedMutation.mutate({
                      bac,
                      brandToken: g.brandToken,
                      productCode: g.productCode,
                      isBugged: nextChecked,
                    });
                  }}
                />
              }
              label=""
            />
          );
        },
      },
      {
        header: "Removed",
        size: 110,
        Cell: ({ row }) => {
          const g = row.original;
          const key = `${g.brandToken}::${g.productCode}`;
          const testKey = `${g.brandToken}-${g.productCode}`;
          const checked = removedOverrides[key] ?? g.isRemoved;
          return (
            <FormControlLabel
              data-testid={`removed-toggle-${testKey}`}
              onClick={(e) => e.stopPropagation()}
              control={
                <Switch
                  size="small"
                  checked={checked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    const nextChecked = e.target.checked;
                    setRemovedOverrides((prev) => ({ ...prev, [key]: nextChecked }));
                    removeMutation.mutate({
                      bac,
                      brandToken: g.brandToken,
                      productCode: g.productCode,
                      isRemoved: nextChecked,
                    });
                  }}
                />
              }
              label=""
            />
          );
        },
      },
      {
        header: "Category",
        size: 200,
        Cell: ({ row }) => {
          const g = row.original;
          const key = `${g.brandToken}::${g.productCode}`;
          const value = categoryDraftByKey[key] ?? (g.category ?? "");
          return (
            <TextField
              size="small"
              value={value}
              placeholder="(placeholder)"
              inputProps={{ "data-testid": `category-input-${key}` }}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                const next = e.target.value;
                setCategoryDraftByKey((prev) => ({ ...prev, [key]: next }));
              }}
              onBlur={() => {
                const raw = (categoryDraftByKey[key] ?? "").trim();
                const next = raw === "" ? null : raw;
                const current = g.category ?? null;
                if (next === current) return;
                categoryMutation.mutate(
                  { bac, brandToken: g.brandToken, productCode: g.productCode, category: next },
                  {
                    onSuccess: () => {
                      setCategoryDraftByKey((prev) => {
                        const copy = { ...prev };
                        delete copy[key];
                        return copy;
                      });
                    },
                  },
                );
              }}
            />
          );
        },
      },
      {
        header: "Notes",
        size: 260,
        Cell: ({ row }) => {
          const g = row.original;
          const testKey = `${g.brandToken}-${g.productCode}`;
          const latestNote =
            (g.notes ?? [])
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
          const hasNote = (g.notesCount ?? 0) > 0 && !!latestNote;
          return (
            <Stack spacing={1} alignItems="flex-start">
              <Typography variant="caption" color="text.secondary">
                <span data-testid={`notes-count-${testKey}`}>{g.notesCount} note(s)</span>
              </Typography>
              <MuiButton
                size="small"
                variant="outlined"
                data-testid={hasNote ? `note-view-${testKey}` : `note-add-${testKey}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setNoteDialog({
                    open: true,
                    brandToken: g.brandToken,
                    productCode: g.productCode,
                    noteId: latestNote?.id ?? null,
                    initialContent: latestNote?.noteText ?? "",
                  });
                }}
              >
                {hasNote ? "View note" : "Add note"}
              </MuiButton>
            </Stack>
          );
        },
      },
    ],
    [
      bac,
      buggedMutation,
      buggedOverrides,
      categoryDraftByKey,
      categoryMutation,
      isMobile,
      removeMutation,
      removedOverrides,
      shouldShowFlag,
      statusMutation,
      statusOverrides,
      statusesQuery.data,
    ],
  );

  const diGroups = useMemo(() => {
    if (!data) return [];
    const byStatus = new Map<string, DrilldownDto["diRows"]>();
    for (const r of data.diRows) {
      const list = byStatus.get(r.status) ?? [];
      list.push(r);
      byStatus.set(r.status, list);
    }
    const order = ["pending live", "live", "pending cancel", "cancelled"];
    return [...byStatus.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([status, rows]) => ({
      status,
      rows: rows.sort((a, b) => a.productCode.localeCompare(b.productCode)),
    }));
  }, [data]);

  const gmGroups = useMemo(() => {
    if (!data) return [];
    const byStatus = new Map<string, DrilldownDto["gmRows"]>();
    for (const r of data.gmRows) {
      const list = byStatus.get(r.status) ?? [];
      list.push(r);
      byStatus.set(r.status, list);
    }
    const order = ["pending live", "live", "pending cancel", "cancelled"];
    return [...byStatus.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([status, rows]) => ({
      status,
      rows: rows.sort((a, b) => a.productCode.localeCompare(b.productCode)),
    }));
  }, [data]);

  const setHoverKey = (key: string | null) => setHighlightKey(key);

  const parseMixedStatuses = useCallback((label: string): string[] | null => {
    const raw = String(label ?? "").trim();
    const m = raw.match(/^Mixed\s*\((.+)\)\s*$/i);
    if (!m) return null;
    const inner = m[1] ?? "";
    const parts = inner
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : null;
  }, []);

  const renderStatusValue = (label: string) => {
    const mixed = parseMixedStatuses(label);
    if (!mixed) return <Typography variant="body2">{label}</Typography>;

    const open = (anchorEl: HTMLElement) => {
      if (statusCloseTimer.current) {
        window.clearTimeout(statusCloseTimer.current);
        statusCloseTimer.current = null;
      }
      setStatusPopover((prev) => {
        if (prev.anchorEl === anchorEl && prev.statuses.join("|") === mixed.join("|")) return prev;
        return { anchorEl, statuses: mixed };
      });
    };

    const closeLater = () => {
      if (isMobile) return;
      if (statusCloseTimer.current) window.clearTimeout(statusCloseTimer.current);
      statusCloseTimer.current = window.setTimeout(() => {
        setStatusPopover({ anchorEl: null, statuses: [] });
        statusCloseTimer.current = null;
      }, 120);
    };

    return (
      <Typography
        variant="body2"
        sx={{ cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
        onClick={(e) => {
          if (!isMobile) return;
          e.stopPropagation();
          setStatusPopover((prev) => {
            if (prev.anchorEl === e.currentTarget) return { anchorEl: null, statuses: [] };
            return { anchorEl: e.currentTarget, statuses: mixed };
          });
        }}
        onMouseEnter={(e) => {
          if (isMobile) return;
          open(e.currentTarget);
        }}
        onMouseLeave={closeLater}
      >
        Mixed
      </Typography>
    );
  };

  const fmtIsoDate = (iso: string | null | undefined): string => {
    if (!iso) return "—";
    // Most of our values are already YYYY-MM-DD strings (from server fmtDate), but rows are full ISO strings.
    const s = String(iso);
    if (s.length >= 10) return s.slice(0, 10);
    return s;
  };

  const money = (n: number): string => {
    if (!Number.isFinite(n)) return "—";
    return n.toFixed(2);
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Breadcrumbs sx={{ mb: 1 }}>
          <MuiLink component={NextLink} href="/runs" underline="hover" color="inherit">
            Run Results
          </MuiLink>
          <MuiLink component={NextLink} href={`/runs/${runId}`} underline="hover" color="inherit">
            Run {runId.slice(0, 8)}
          </MuiLink>
          <Typography color="text.primary">BAC {bac}</Typography>
        </Breadcrumbs>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
          <Typography variant="h4" fontWeight={800} flex={1}>
            BAC {bac}
          </Typography>
          <MuiButton variant="text" onClick={() => (window.location.href = `/runs/${runId}`)} data-testid="back-to-results">
            Back to results
          </MuiButton>
          <MuiButton
            variant="outlined"
            disabled={undoMutation.isPending}
            onClick={() => {
              undoMutation.mutate();
            }}
          >
            Undo last change
          </MuiButton>
          <MuiButton
            variant="outlined"
            color="error"
            disabled={resetMutation.isPending}
            onClick={() => {
              const ok = window.confirm("Reset this BAC? This will clear Removed/Bugged/Category/Status back to defaults.");
              if (!ok) return;
              resetMutation.mutate();
            }}
          >
            Reset BAC
          </MuiButton>
          <MuiButton
            variant="outlined"
            onClick={() => {
              window.location.href = `/api/runs/${runId}/export/bacs/${bac}?format=csv`;
            }}
          >
            Export CSV
          </MuiButton>
          <MuiButton
            variant="outlined"
            onClick={() => {
              window.location.href = `/api/runs/${runId}/export/bacs/${bac}?format=xlsx&includeRaw=true`;
            }}
          >
            Export XLSX (with raw)
          </MuiButton>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={1}>
          {(() => {
            const gm = Number(String(data?.header.gmTotal ?? "NaN"));
            const di = Number(String(data?.header.diTotal ?? "NaN"));
            const delta = Number(String(data?.header.delta ?? "NaN"));
            const gmIsLower = Number.isFinite(gm) && Number.isFinite(di) && gm < di;
            const diIsLower = Number.isFinite(gm) && Number.isFinite(di) && di < gm;
            const deltaIsPositive = Number.isFinite(delta) && delta > 0;
            return (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={pricingMode === "latest"}
                      onChange={(e) => {
                        const nextMode = e.target.checked ? "latest" : "run";
                        const sp = new URLSearchParams(searchParams.toString());
                        if (nextMode === "latest") sp.set("pricingMode", "latest");
                        else sp.delete("pricingMode");
                        const qs = sp.toString();
                        router.replace(qs ? `?${qs}` : "?", { scroll: false });
                      }}
                    />
                  }
                  label="Use latest pricing"
                />
                <Chip label={`GM total: ${data?.header.gmTotal ?? "—"}`} color={gmIsLower ? "warning" : "default"} />
                <Chip label={`DI total: ${data?.header.diTotal ?? "—"}`} color={diIsLower ? "warning" : "default"} />
                <Chip
                  label={`Δ: ${data?.header.delta ?? "—"}`}
                  color={deltaIsPositive ? "error" : "default"}
                  variant={deltaIsPositive ? "filled" : "outlined"}
                />
                {(data?.groups ?? []).some((g) => g.isBugged) ? (
                  <Chip label="DPE Bugged" color="error" variant="filled" />
                ) : null}
              </>
            );
          })()}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          <strong>DI brands:</strong> {data ? formatBrandSet(data.diRows.map((r) => r.brandToken)) || "—" : "—"}{" "}
          <span style={{ opacity: 0.7 }}>|</span>{" "}
          <strong>GM brands:</strong> {data ? formatBrandSet(data.gmRows.map((r) => r.productBrand)) || "—" : "—"}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1} sx={{ mb: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
              <Typography variant="subtitle1" fontWeight={700} flex={1}>
                {productsTab === 0 ? "Products causing variance" : "All products"}
              </Typography>
              <Tabs
                value={productsTab}
                onChange={(_, next) => setProductsTab(next as 0 | 1)}
                variant="scrollable"
                allowScrollButtonsMobile
              >
                <Tab label={`Products causing variance (${varianceGroups.length})`} value={0} />
                <Tab label={`All products (${data?.groups?.length ?? 0})`} value={1} />
              </Tabs>
            </Stack>
            {productsTab === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Only products with a true dollar variance (Δ outside tolerance) are shown here. Switch to “All products” to see $0 rows
                (including excluded rows) and other flagged context.
              </Typography>
            ) : null}
          </Stack>
          <MaterialReactTable
            columns={groupColumns}
            data={productsTab === 0 ? varianceGroups : (data?.groups ?? [])}
            state={{
              isLoading: query.isLoading,
              showAlertBanner: query.isError,
              showProgressBars: query.isFetching,
              rowSelection,
            }}
            enableRowVirtualization
            enableColumnVirtualization
            muiTableContainerProps={{ sx: { overflowX: "auto", maxHeight: { xs: "65vh", md: "70vh" } } }}
            enableRowSelection
            onRowSelectionChange={setRowSelection}
            getRowId={(row) => `${row.brandToken}::${row.productCode}`}
            renderTopToolbarCustomActions={({ table }) => {
              const selected = table.getSelectedRowModel().rows.map((r) => ({
                brandToken: r.original.brandToken,
                productCode: r.original.productCode,
              }));
              const canAct = selected.length > 0 && !bulkMutation.isPending;
              const options = (statusesQuery.data ?? [])
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
                .map((s) => s.name);
              const safeOptions = options.length ? options : ["Open", "Investigating", "Blocked", "Closed", "Resolved", "Archived"];

              return (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    {selected.length ? `${selected.length} selected` : "Select rows for bulk actions"}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <MuiButton
                      size="small"
                      variant="outlined"
                      disabled={!canAct}
                      onClick={() => bulkMutation.mutate({ bac, items: selected, patch: { isRemoved: true } })}
                    >
                      Mark removed
                    </MuiButton>
                    <MuiButton
                      size="small"
                      variant="outlined"
                      disabled={!canAct}
                      onClick={() => bulkMutation.mutate({ bac, items: selected, patch: { isRemoved: false } })}
                    >
                      Unremove
                    </MuiButton>
                    <MuiButton
                      size="small"
                      variant="outlined"
                      disabled={!canAct}
                      onClick={() => bulkMutation.mutate({ bac, items: selected, patch: { isBugged: true } })}
                    >
                      Mark bugged
                    </MuiButton>
                    <MuiButton
                      size="small"
                      variant="outlined"
                      disabled={!canAct}
                      onClick={() => bulkMutation.mutate({ bac, items: selected, patch: { isBugged: false } })}
                    >
                      Unbug
                    </MuiButton>
                    <MuiButton
                      size="small"
                      variant="outlined"
                      disabled={!canAct}
                      onClick={() => {
                        const raw = window.prompt("Set category (leave blank to clear):", "");
                        if (raw === null) return;
                        const next = raw.trim();
                        bulkMutation.mutate({ bac, items: selected, patch: { category: next ? next : null } });
                      }}
                    >
                      Set category
                    </MuiButton>
                    <MuiButton
                      size="small"
                      variant="outlined"
                      disabled={!canAct}
                      onClick={() => {
                        const raw = window.prompt(`Set status (options: ${safeOptions.join(", ")}):`, safeOptions[0] ?? "Open");
                        if (raw === null) return;
                        const next = raw.trim();
                        if (!next) return;
                        bulkMutation.mutate({ bac, items: selected, patch: { status: next } });
                      }}
                    >
                      Set status
                    </MuiButton>
                  </Stack>
                </Stack>
              );
            }}
            enableColumnFilters={false}
            enableDensityToggle={false}
            enableFullScreenToggle={false}
            enablePagination={false}
            muiTableBodyRowProps={({ row }) => ({
              onMouseEnter: () => setHoverKey(`${row.original.brandToken}::${row.original.productCode}`),
              onMouseLeave: () => setHoverKey(null),
              onClick: () => openDetails(row.original.brandToken, row.original.productCode),
              "data-testid": `group-row-${row.original.brandToken}-${row.original.productCode}`,
              "data-brand-token": row.original.brandToken,
              "data-product-code": row.original.productCode,
              title: row.original.context?.displayName ?? undefined,
              sx: highlightKey === `${row.original.brandToken}::${row.original.productCode}` ? { backgroundColor: "action.hover" } : undefined,
            })}
          />
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems="stretch">
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              DI rows
            </Typography>
            {diGroups.map((g) => (
              <Box key={g.status} sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                  {g.status.toUpperCase()}
                </Typography>
                <Stack spacing={1}>
                  {g.rows.map((r, idx) => (
                    <Box
                      key={`${r.matchKey}-${idx}`}
                      data-testid={`di-row-${idx}`}
                      data-side="di"
                      data-match-key={r.matchKey}
                      data-highlighted={highlightKey === r.matchKey ? "true" : "false"}
                      onClick={() => openDetails(r.brandToken, r.productCode, { di: r.rowKey })}
                      onMouseEnter={() => setHoverKey(r.matchKey)}
                      onMouseLeave={() => setHoverKey(null)}
                      sx={{
                        p: 1,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        backgroundColor: highlightKey === r.matchKey ? "action.hover" : "transparent",
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={r.brandToken} />
                        <Typography variant="body2" fontWeight={600}>
                          {r.productCode}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ${r.dealerPrice}
                        </Typography>
                        {!r.isIncludedInTotals ? <Chip size="small" color="warning" label="EXCLUDED" /> : null}
                        {r.exclusionReasons
                          .map((er) => ({ er, label: exclusionLabel(er) }))
                          .filter((x) => !!x.label)
                          .map((x) => (
                            <Chip key={x.er} size="small" variant="outlined" label={x.label} />
                          ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
                <Divider sx={{ mt: 2 }} />
              </Box>
            ))}
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              GM rows
            </Typography>
            {gmGroups.map((g) => (
              <Box key={g.status} sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                  {g.status.toUpperCase()}
                </Typography>
                <Stack spacing={1}>
                  {g.rows.map((r, idx) => (
                    <Box
                      key={`${r.matchKey}-${idx}`}
                      data-testid={`gm-row-${idx}`}
                      data-side="gm"
                      data-match-key={r.matchKey}
                      data-highlighted={highlightKey === r.matchKey ? "true" : "false"}
                      onClick={() => openDetails(r.productBrand, r.productCode, { gm: r.rowKey })}
                      onMouseEnter={() => setHoverKey(r.matchKey)}
                      onMouseLeave={() => setHoverKey(null)}
                      sx={{
                        p: 1,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        backgroundColor: highlightKey === r.matchKey ? "action.hover" : "transparent",
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={r.productBrand} />
                        <Typography variant="body2" fontWeight={600}>
                          {r.productCode}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ${r.dealerCost}
                        </Typography>
                        {!r.isIncludedInTotals ? <Chip size="small" color="warning" label="EXCLUDED" /> : null}
                        {r.isDesync ? <Chip size="small" color="info" label="DESYNC" /> : null}
                        {r.exclusionReasons
                          .map((er) => ({ er, label: exclusionLabel(er) }))
                          .filter((x) => !!x.label)
                          .map((x) => (
                            <Chip key={x.er} size="small" variant="outlined" label={x.label} />
                          ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
                <Divider sx={{ mt: 2 }} />
              </Box>
            ))}
          </CardContent>
        </Card>
      </Stack>

      {legendCodes.length ? (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={800} gutterBottom>
              Legend (this BAC)
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "max-content 1fr",
                columnGap: 2,
                rowGap: 1.5,
                alignItems: "start",
              }}
            >
              {legendCodes.map((code) => {
                const meta = flagChipProps(code);
                const desc = flagDescription(code);
                return (
                  <Box key={code} sx={{ display: "contents" }}>
                    <Box sx={{ pt: 0.25 }}>
                      <Chip size="small" color={meta.color} variant={meta.variant} label={meta.label} />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        {desc.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {desc.description}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      ) : null}

      <Popper
        open={Boolean(flagPopover.anchorEl)}
        anchorEl={flagPopover.anchorEl}
        placement="bottom-start"
        modifiers={[{ name: "offset", options: { offset: [0, 6] } }]}
      >
        <ClickAwayListener onClickAway={() => setFlagPopover({ anchorEl: null, flags: [] })}>
          <Paper
            elevation={8}
            sx={{ p: 1, maxWidth: 260 }}
            onMouseEnter={() => {
              if (isMobile) return;
              if (flagCloseTimer.current) {
                window.clearTimeout(flagCloseTimer.current);
                flagCloseTimer.current = null;
              }
            }}
            onMouseLeave={() => {
              if (isMobile) return;
              if (flagCloseTimer.current) window.clearTimeout(flagCloseTimer.current);
              flagCloseTimer.current = window.setTimeout(() => {
                setFlagPopover({ anchorEl: null, flags: [] });
                flagCloseTimer.current = null;
              }, 120);
            }}
          >
            <Stack spacing={0.75}>
              {flagPopover.flags.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No flags
                </Typography>
              ) : (
                flagPopover.flags.map((f) => {
                  const meta = flagChipProps(f);
                  return <Chip key={f} size="small" color={meta.color} variant={meta.variant} label={meta.label} />;
                })
              )}
            </Stack>
          </Paper>
        </ClickAwayListener>
      </Popper>

      <Popper
        open={Boolean(statusPopover.anchorEl)}
        anchorEl={statusPopover.anchorEl}
        placement="bottom-start"
        modifiers={[{ name: "offset", options: { offset: [0, 6] } }]}
      >
        <ClickAwayListener onClickAway={() => setStatusPopover({ anchorEl: null, statuses: [] })}>
          <Paper
            elevation={8}
            sx={{ p: 1, maxWidth: 260 }}
            onMouseEnter={() => {
              if (isMobile) return;
              if (statusCloseTimer.current) {
                window.clearTimeout(statusCloseTimer.current);
                statusCloseTimer.current = null;
              }
            }}
            onMouseLeave={() => {
              if (isMobile) return;
              if (statusCloseTimer.current) window.clearTimeout(statusCloseTimer.current);
              statusCloseTimer.current = window.setTimeout(() => {
                setStatusPopover({ anchorEl: null, statuses: [] });
                statusCloseTimer.current = null;
              }, 120);
            }}
          >
            <Stack spacing={0.75}>
              {statusPopover.statuses.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No statuses
                </Typography>
              ) : (
                statusPopover.statuses.map((s) => <Chip key={s} size="small" variant="outlined" label={s} />)
              )}
            </Stack>
          </Paper>
        </ClickAwayListener>
      </Popper>

      <Dialog
        open={noteDialog.open}
        onClose={() => setNoteDialog((p) => ({ ...p, open: false }))}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pr: 6 }}>
          {noteDialog.noteId ? "View note" : "Add note"} — {noteDialog.brandToken} / {noteDialog.productCode}
          <IconButton
            aria-label="Close"
            onClick={() => setNoteDialog((p) => ({ ...p, open: false }))}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Tip: use notes to capture why you removed a variance, what you verified, or what needs follow-up.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} sx={{ mb: 1 }}>
            <TextField
              select
              size="small"
              label="Template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(String(e.target.value))}
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="">(none)</MenuItem>
              {(templatesQuery.data ?? []).map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
            <MuiButton
              variant="outlined"
              disabled={!selectedTemplateId}
              onClick={() => {
                const t = (templatesQuery.data ?? []).find((x) => x.id === selectedTemplateId) ?? null;
                if (!t) return;
                const editor = noteEditorRef.current?.editor;
                if (!editor) return;
                editor.chain().focus().insertContent(t.content).run();
              }}
            >
              Insert template
            </MuiButton>
            <Box sx={{ flex: 1 }} />
          </Stack>
          <RichTextEditor
            key={`${noteDialog.noteId ?? "new"}:${noteDialog.open ? "open" : "closed"}`}
            ref={noteEditorRef}
            content={noteDialog.initialContent || ""}
            extensions={[StarterKit]}
            immediatelyRender={false}
            renderControls={() => (
              <MenuControlsContainer>
                <MenuButtonBold />
                <MenuButtonItalic />
                <MenuButtonUnderline />
                <MenuButtonStrikethrough />
                <MenuDivider />
              </MenuControlsContainer>
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          {noteDialog.noteId ? (
            <>
              <MuiButton
                color="error"
                onClick={() => {
                  if (!noteDialog.noteId) return;
                  const ok = window.confirm("Delete this note?");
                  if (!ok) return;
                  noteDeleteMutation.mutate(
                    { noteId: noteDialog.noteId },
                    { onSuccess: () => setNoteDialog((p) => ({ ...p, open: false })) },
                  );
                }}
              >
                Delete
              </MuiButton>
              <Box sx={{ flex: 1 }} />
              <MuiButton
                variant="contained"
                onClick={() => {
                  if (!noteDialog.noteId) return;
                  const html = noteEditorRef.current?.editor?.getHTML?.() ?? "";
                  const text = html.trim();
                  if (!text) return;
                  noteUpdateMutation.mutate(
                    { noteId: noteDialog.noteId, noteText: text },
                    { onSuccess: () => setNoteDialog((p) => ({ ...p, open: false })) },
                  );
                }}
              >
                Edit
              </MuiButton>
              <MuiButton variant="text" onClick={() => setNoteDialog((p) => ({ ...p, open: false }))}>
                Close
              </MuiButton>
            </>
          ) : (
            <>
              <MuiButton variant="text" onClick={() => setNoteDialog((p) => ({ ...p, open: false }))}>
                Cancel
              </MuiButton>
              <MuiButton
                variant="contained"
                onClick={() => {
                  const html = noteEditorRef.current?.editor?.getHTML?.() ?? "";
                  const text = html.trim();
                  if (!text) return;
                  noteCreateMutation.mutate(
                    { bac, brandToken: noteDialog.brandToken, productCode: noteDialog.productCode, noteText: text },
                    { onSuccess: () => setNoteDialog((p) => ({ ...p, open: false })) },
                  );
                }}
              >
                Add
              </MuiButton>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        PaperProps={{
          sx: isMobile ? { height: "92vh" } : { width: 440, maxWidth: "100%" },
        }}
      >
        {(() => {
          const selected =
            detailsKey && data?.groups ? data.groups.find((g) => `${g.brandToken}::${g.productCode}` === detailsKey) : null;
          if (!selected) {
            return (
              <Box sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="h6" fontWeight={800} flex={1}>
                    Details
                  </Typography>
                  <IconButton onClick={() => setDetailsOpen(false)}>
                    <CloseIcon />
                  </IconButton>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Select a row to view context.
                </Typography>
              </Box>
            );
          }

          const ctx = selected.context;
          const pricing = ctx.pricing;
          const key = `${selected.brandToken}::${selected.productCode}`;
          const diRowsForProduct = (data?.diRows ?? []).filter(
            (r) => r.brandToken === selected.brandToken && r.productCode === selected.productCode,
          );
          const gmRowsForProduct = (data?.gmRows ?? []).filter(
            (r) => r.productBrand === selected.brandToken && r.productCode === selected.productCode,
          );

          const defaultDi =
            diRowsForProduct.find((r) => r.rowKey === detailsRowKeys.di) ??
            diRowsForProduct.find((r) => r.isIncludedInTotals) ??
            diRowsForProduct[0] ??
            null;
          const defaultGm =
            gmRowsForProduct.find((r) => r.rowKey === detailsRowKeys.gm) ??
            gmRowsForProduct.find((r) => r.isIncludedInTotals) ??
            gmRowsForProduct[0] ??
            null;

          const diStatus = defaultDi?.status ?? "—";
          const gmStatus = defaultGm?.status ?? "—";
          const diEff = defaultDi?.effectiveDateUtc ?? null;
          const gmEff = defaultGm?.effectiveDateUtc ?? null;
          const diLast = defaultDi?.lastUpdatedDateUtc ?? null;
          const gmLast = defaultGm?.lastUpdatedDateUtc ?? null;
          const diQty = defaultDi?.quantity ?? 0;
          const gmQty = defaultGm?.quantity ?? 0;
          const diUnit = Number(String(defaultDi?.dealerPrice ?? "NaN"));
          const gmUnit = Number(String(defaultGm?.dealerCost ?? "NaN"));
          const expectedUnit = pricing ? Number(String(pricing.expectedUnitPrice ?? "NaN")) : NaN;

          const diUnitMismatch =
            pricing && Number.isFinite(expectedUnit) && Number.isFinite(diUnit) ? Math.abs(diUnit - expectedUnit) > 0.01 : false;
          const gmUnitMismatch =
            pricing && Number.isFinite(expectedUnit) && Number.isFinite(gmUnit) ? Math.abs(gmUnit - expectedUnit) > 0.01 : false;
          const rawFlags = (selected.flags?.flags ?? []).filter(shouldShowFlag);
          const codes = [...rawFlags];
          if (selected.flags?.isVariance) codes.push("VARIANCE");

          return (
            <Box sx={{ p: 2, pt: 3 }} data-testid={`details-drawer-${key}`}>
              {/* Spacer so drawer content doesn't sit under fixed app header */}
              <Box sx={theme.mixins.toolbar} />
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.15 }}>
                    {ctx.displayName ?? selected.productCode}
                  </Typography>
                </Box>
                <IconButton onClick={() => setDetailsOpen(false)} aria-label="Close details">
                  <CloseIcon />
                </IconButton>
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {brandTokenLabel(selected.brandToken)}
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Product Code: <strong>{selected.productCode}</strong>
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {codes.includes("VARIANCE") ? <Chip size="small" color="error" label="Variance" /> : null}
                {ctx.statusMismatch ? <Chip size="small" color="warning" label="Status mismatch" /> : null}
                {ctx.pricingMismatch.di || ctx.pricingMismatch.gm ? (
                  <Chip size="small" color="error" label="Pricing mismatch" />
                ) : null}
                {codes.includes("BRAND_MISMATCH") ? <Chip size="small" color="warning" label="Brand mismatch" /> : null}
                {selected.isBugged ? <Chip size="small" color="error" variant="outlined" label="DPE Bugged" /> : null}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                Summary
              </Typography>
              {(diRowsForProduct.length > 1 || gmRowsForProduct.length > 1) ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    select
                    size="small"
                    label="DI row"
                    value={defaultDi?.rowKey ?? ""}
                    onChange={(e) => setDetailsRowKeys((p) => ({ ...p, di: e.target.value }))}
                    sx={{ minWidth: 220 }}
                  >
                    {diRowsForProduct.map((r, idx) => (
                      <MenuItem key={r.rowKey} value={r.rowKey}>
                        {`#${idx + 1}${r.orderItemId ? ` • ${r.orderItemId}` : ""} • ${r.status} • $${r.dealerPrice}`}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="GM row"
                    value={defaultGm?.rowKey ?? ""}
                    onChange={(e) => setDetailsRowKeys((p) => ({ ...p, gm: e.target.value }))}
                    sx={{ minWidth: 220 }}
                  >
                    {gmRowsForProduct.map((r, idx) => (
                      <MenuItem key={r.rowKey} value={r.rowKey}>
                        {`#${idx + 1} • ${r.status} • $${r.dealerCost}`}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              ) : null}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr 1fr",
                  gap: 1,
                  alignItems: "center",
                }}
              >
                <Box />
                <Typography variant="caption" fontWeight={800}>
                  DI
                </Typography>
                <Typography variant="caption" fontWeight={800}>
                  GM
                </Typography>

                <Typography variant="body2" fontWeight={700}>
                  Total
                </Typography>
                <Typography variant="body2">
                  {defaultDi ? `$${money(diUnit * diQty)}` : `$${ctx.observed.diTotal}`}
                </Typography>
                <Typography variant="body2">
                  {defaultGm ? `$${money(gmUnit * gmQty)}` : `$${ctx.observed.gmTotal}`}
                </Typography>

                <Typography variant="body2" fontWeight={700}>
                  Status
                </Typography>
                <Box>{renderStatusValue(diStatus)}</Box>
                <Box>{renderStatusValue(gmStatus)}</Box>

                <Typography variant="body2" fontWeight={700}>
                  Effective date
                </Typography>
                <Typography variant="body2">{defaultDi ? fmtIsoDate(diEff) : ctx.observed.diEffectiveDate}</Typography>
                <Typography variant="body2">{defaultGm ? fmtIsoDate(gmEff) : ctx.observed.gmEffectiveDate}</Typography>

                <Typography variant="body2" fontWeight={700}>
                  Last updated
                </Typography>
                <Typography variant="body2">{defaultDi ? fmtIsoDate(diLast) : ctx.observed.diLastUpdated}</Typography>
                <Typography variant="body2">{defaultGm ? fmtIsoDate(gmLast) : ctx.observed.gmLastUpdated}</Typography>

                <Typography variant="body2" fontWeight={700}>
                  Quantity
                </Typography>
                <Typography variant="body2">{defaultDi ? diQty : ctx.observed.diQty}</Typography>
                <Typography variant="body2">{defaultGm ? gmQty : ctx.observed.gmQty}</Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                Salesforce
              </Typography>
              <Stack spacing={1}>
                <Typography variant="body2">
                  Account:{" "}
                  <strong>
                    {ctx.salesforce.accountName ?? "—"}
                    {ctx.salesforce.accountId ? ` (${ctx.salesforce.accountId})` : ""}
                  </strong>
                </Typography>
                {ctx.salesforce.subscriptionId ? (
                  <Typography variant="body2">
                    Subscription: <strong>{ctx.salesforce.subscriptionId}</strong>
                  </Typography>
                ) : null}
                {ctx.salesforce.orderItemId ? (
                  <Typography variant="body2">
                    Order Item: <strong>{ctx.salesforce.orderItemId}</strong>
                  </Typography>
                ) : null}
                {ctx.salesforce.quoteLineId ? (
                  <Typography variant="body2">
                    Quote Line: <strong>{ctx.salesforce.quoteLineId}</strong>
                  </Typography>
                ) : null}

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {ctx.salesforce.accountId ? (
                    <MuiButton
                      size="small"
                      variant="contained"
                      onClick={() => window.open(new URL(`/${ctx.salesforce.accountId}`, salesforceBaseUrl).toString(), "_blank")}
                    >
                      Open account
                    </MuiButton>
                  ) : null}
                  {ctx.salesforce.subscriptionId ? (
                    <MuiButton
                      size="small"
                      variant="contained"
                      onClick={() => window.open(new URL(`/${ctx.salesforce.subscriptionId}`, salesforceBaseUrl).toString(), "_blank")}
                    >
                      Open subscription
                    </MuiButton>
                  ) : null}
                  {ctx.salesforce.orderItemId ? (
                    <MuiButton
                      size="small"
                      variant="contained"
                      onClick={() => window.open(new URL(`/${ctx.salesforce.orderItemId}`, salesforceBaseUrl).toString(), "_blank")}
                    >
                      Open order item
                    </MuiButton>
                  ) : null}
                  {ctx.salesforce.quoteLineId ? (
                    <MuiButton
                      size="small"
                      variant="contained"
                      onClick={() => window.open(new URL(`/${ctx.salesforce.quoteLineId}`, salesforceBaseUrl).toString(), "_blank")}
                    >
                      Open quote line
                    </MuiButton>
                  ) : null}
                </Stack>

                {ctx.salesforce.matchMethod !== "diRow" ? (
                  <Typography variant="caption" color="text.secondary">
                    Inferred via: {ctx.salesforce.matchMethod}
                    {ctx.salesforce.candidates?.length ? ` (candidates: ${ctx.salesforce.candidates.length})` : ""}
                  </Typography>
                ) : null}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                Pricing
              </Typography>
              {pricing ? (
                <Stack spacing={1}>
                  <Typography variant="body2">
                    Expected Unit Price: <strong>${pricing.expectedUnitPrice}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {pricing.ruleLabel}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" variant="outlined" label={`Pricing code: ${pricing.expectedProductCode}`} />
                    {pricing.websiteTier ? <Chip size="small" variant="outlined" label={pricing.websiteTier} /> : null}
                  </Stack>
                  {(ctx.pricingMismatch.di || ctx.pricingMismatch.gm) ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {ctx.pricingMismatch.di ? <Chip size="small" color="error" label="DI != expected" /> : null}
                      {ctx.pricingMismatch.gm ? <Chip size="small" color="error" label="GM != expected" /> : null}
                    </Stack>
                  ) : (
                    <Chip size="small" color="success" label="Matches expected" />
                  )}
                  {(diUnitMismatch || gmUnitMismatch) ? (
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {diUnitMismatch ? <Chip size="small" color="error" label="DI unit != expected" /> : null}
                      {gmUnitMismatch ? <Chip size="small" color="error" label="GM unit != expected" /> : null}
                    </Stack>
                  ) : null}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No pricing rule match for this product.
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                Why this is flagged
              </Typography>
              {Array.isArray(ctx.reasons) && ctx.reasons.length ? (
                <Stack spacing={1}>
                  {ctx.reasons.map((r, idx) => (
                    <Typography key={idx} variant="body2">
                      • {r}
                    </Typography>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No computed reasons. (It may still be flagged by other issues.)
                </Typography>
              )}
            </Box>
          );
        })()}
      </Drawer>
    </Stack>
  );
}


