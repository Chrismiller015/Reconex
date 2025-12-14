"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  Box,
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
  Paper,
  Popper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
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
    category: string | null;
    flags: { flags?: string[]; isVariance?: boolean };
    context: {
      displayName: string | null;
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
    matchKey: string;
    productCode: string;
    brandToken: string;
    status: string;
    dealerPrice: string;
    isIncludedInTotals: boolean;
    exclusionReasons: string[];
    raw: Record<string, unknown>;
  }>;
  gmRows: Array<{
    matchKey: string;
    productCode: string;
    productBrand: string;
    status: string;
    dealerCost: string;
    isBilling: boolean;
    isDesync: boolean;
    isIncludedInTotals: boolean;
    exclusionReasons: string[];
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const noteEditorRef = useRef<RichTextEditorRef>(null);

  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [categoryDraftByKey, setCategoryDraftByKey] = useState<Record<string, string>>({});
  const [removedOverrides, setRemovedOverrides] = useState<Record<string, boolean>>({});
  const [noteDialog, setNoteDialog] = useState<{
    open: boolean;
    brandToken: string;
    productCode: string;
    noteId: string | null;
    initialContent: string;
  }>({ open: false, brandToken: "", productCode: "", noteId: null, initialContent: "" });
  const [flagPopover, setFlagPopover] = useState<{ anchorEl: HTMLElement | null; flags: string[] }>({
    anchorEl: null,
    flags: [],
  });
  const flagCloseTimer = useRef<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsKey, setDetailsKey] = useState<string | null>(null);
  const [productsTab, setProductsTab] = useState<0 | 1>(0);

  const openDetails = useCallback((brandToken: string, productCode: string) => {
    const key = `${brandToken}::${productCode}`;
    setDetailsKey(key);
    setDetailsOpen(true);
  }, []);

  const query = useQuery({
    queryKey: ["bac-drilldown", runId, bac],
    queryFn: async (): Promise<DrilldownDto> => {
      const res = await fetch(`/api/runs/${runId}/bacs/${bac}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load drilldown");
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
        header: "Removed",
        size: 110,
        Cell: ({ row }) => {
          const g = row.original;
          const key = `${g.brandToken}::${g.productCode}`;
          const checked = removedOverrides[key] ?? g.isRemoved;
          return (
            <FormControlLabel
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
          const key = `${g.brandToken}::${g.productCode}`;
          const latestNote =
            (g.notes ?? [])
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
          const hasNote = (g.notesCount ?? 0) > 0 && !!latestNote;
          return (
            <Stack spacing={1} alignItems="flex-start">
              <Typography variant="caption" color="text.secondary">
                <span data-testid={`notes-count-${key}`}>{g.notesCount} note(s)</span>
              </Typography>
              <MuiButton
                size="small"
                variant="outlined"
                data-testid={hasNote ? `note-view-${key}` : `note-add-${key}`}
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
    [bac, categoryDraftByKey, categoryMutation, isMobile, removeMutation, removedOverrides, shouldShowFlag],
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

  return (
    <Stack spacing={2}>
      <Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
          <Typography variant="h4" fontWeight={800} flex={1}>
            BAC {bac}
          </Typography>
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
                <Chip label={`GM total: ${data?.header.gmTotal ?? "—"}`} color={gmIsLower ? "warning" : "default"} />
                <Chip label={`DI total: ${data?.header.diTotal ?? "—"}`} color={diIsLower ? "warning" : "default"} />
                <Chip
                  label={`Δ: ${data?.header.delta ?? "—"}`}
                  color={deltaIsPositive ? "error" : "default"}
                  variant={deltaIsPositive ? "filled" : "outlined"}
                />
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
            }}
            muiTableContainerProps={{ sx: { overflowX: "auto" } }}
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
                      onClick={() => openDetails(r.brandToken, r.productCode)}
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
                      onClick={() => openDetails(r.productBrand, r.productCode)}
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
          const rawFlags = (selected.flags?.flags ?? []).filter(shouldShowFlag);
          const codes = [...rawFlags];
          if (selected.flags?.isVariance) codes.push("VARIANCE");

          return (
            <Box sx={{ p: 2, pt: 3 }} data-testid={`details-drawer-${key}`}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="h5" fontWeight={900} flex={1} sx={{ lineHeight: 1.15 }}>
                  {selected.brandToken} / {selected.productCode}
                </Typography>
                <IconButton onClick={() => setDetailsOpen(false)} aria-label="Close details">
                  <CloseIcon />
                </IconButton>
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {brandTokenLabel(selected.brandToken)}
              </Typography>

              {ctx.displayName ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {ctx.displayName}
                </Typography>
              ) : null}

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {codes.includes("VARIANCE") ? <Chip size="small" color="error" label="Variance" /> : null}
                {ctx.statusMismatch ? <Chip size="small" color="warning" label="Status mismatch" /> : null}
                {ctx.pricingMismatch.di || ctx.pricingMismatch.gm ? (
                  <Chip size="small" color="error" label="Pricing mismatch" />
                ) : null}
                {codes.includes("BRAND_MISMATCH") ? <Chip size="small" color="warning" label="Brand mismatch" /> : null}
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                Summary
              </Typography>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`DI total: $${ctx.observed.diTotal}`} />
                  <Chip size="small" label={`GM total: $${ctx.observed.gmTotal}`} />
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" variant="outlined" label={`DI status: ${ctx.observed.diStatus}`} />
                  <Chip size="small" variant="outlined" label={`GM status: ${ctx.observed.gmStatus}`} />
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" variant="outlined" label={`DI effective: ${ctx.observed.diEffectiveDate}`} />
                  <Chip size="small" variant="outlined" label={`GM effective: ${ctx.observed.gmEffectiveDate}`} />
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" variant="outlined" label={`DI updated: ${ctx.observed.diLastUpdated}`} />
                  <Chip size="small" variant="outlined" label={`GM updated: ${ctx.observed.gmLastUpdated}`} />
                </Stack>
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

