"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
  Button as MuiButton,
} from "@mui/material";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { flagChipProps } from "@/components/runs/flagPresentation";

type RunSummaryDto = {
  runId: string;
  kpis: { bacsWithVariance: number; totalGm: string; totalDi: string; netDelta: string };
  bacs: Array<{
    bac: string;
    gmTotal: string;
    diTotal: string;
    delta: string;
    flags: string[];
    notesCount: number;
    hasRemovedGroups: boolean;
    allVarianceGroupsRemoved: boolean;
  }>;
};

export function RunSummaryView() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const DEFAULTS = useMemo(
    () => ({
      showRemoved: false,
      bacSearch: "",
      minAbsDelta: "",
      brandToken: "",
      productCode: "",
      onlyOutsideTolerance: true, // default ON
      onlyTerminated: false,
      onlyDuplicates: false,
      onlyDesync: false,
      onlyMissingOnGm: false,
      onlyMissingOnDi: false,
    }),
    [],
  );

  const storageKey = useMemo(() => `reconex:runSummaryFilters:${runId}`, [runId]);
  const hydratedRef = useRef(false);
  const isSyncingUrlRef = useRef(false);

  const [showRemoved, setShowRemoved] = useState(DEFAULTS.showRemoved);
  const [bacSearch, setBacSearch] = useState(DEFAULTS.bacSearch);
  const [minAbsDelta, setMinAbsDelta] = useState(DEFAULTS.minAbsDelta);
  const [brandToken, setBrandToken] = useState(DEFAULTS.brandToken);
  const [productCode, setProductCode] = useState(DEFAULTS.productCode);
  const [onlyOutsideTolerance, setOnlyOutsideTolerance] = useState(DEFAULTS.onlyOutsideTolerance);
  const [onlyTerminated, setOnlyTerminated] = useState(DEFAULTS.onlyTerminated);
  const [onlyDuplicates, setOnlyDuplicates] = useState(DEFAULTS.onlyDuplicates);
  const [onlyDesync, setOnlyDesync] = useState(DEFAULTS.onlyDesync);
  const [onlyMissingOnGm, setOnlyMissingOnGm] = useState(DEFAULTS.onlyMissingOnGm);
  const [onlyMissingOnDi, setOnlyMissingOnDi] = useState(DEFAULTS.onlyMissingOnDi);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const parseBool = (raw: string | null, fallback: boolean): boolean => {
    if (raw === null || raw === undefined) return fallback;
    const v = String(raw).trim().toLowerCase();
    if (v === "1" || v === "true" || v === "yes" || v === "y" || v === "on") return true;
    if (v === "0" || v === "false" || v === "no" || v === "n" || v === "off") return false;
    return fallback;
  };

  const applyFilterState = useCallback((next: Partial<typeof DEFAULTS>) => {
    setShowRemoved(next.showRemoved ?? DEFAULTS.showRemoved);
    setBacSearch(next.bacSearch ?? DEFAULTS.bacSearch);
    setMinAbsDelta(next.minAbsDelta ?? DEFAULTS.minAbsDelta);
    setBrandToken(next.brandToken ?? DEFAULTS.brandToken);
    setProductCode(next.productCode ?? DEFAULTS.productCode);
    setOnlyOutsideTolerance(next.onlyOutsideTolerance ?? DEFAULTS.onlyOutsideTolerance);
    setOnlyTerminated(next.onlyTerminated ?? DEFAULTS.onlyTerminated);
    setOnlyDuplicates(next.onlyDuplicates ?? DEFAULTS.onlyDuplicates);
    setOnlyDesync(next.onlyDesync ?? DEFAULTS.onlyDesync);
    setOnlyMissingOnGm(next.onlyMissingOnGm ?? DEFAULTS.onlyMissingOnGm);
    setOnlyMissingOnDi(next.onlyMissingOnDi ?? DEFAULTS.onlyMissingOnDi);
  }, [DEFAULTS]);

  // Hydrate state from URL (preferred) or localStorage (fallback).
  useEffect(() => {
    if (hydratedRef.current) return;

    const sp = searchParams;
    const urlHasAnyKnown =
      sp.has("showRemoved") ||
      sp.has("bac") ||
      sp.has("minAbsDelta") ||
      sp.has("brand") ||
      sp.has("productCode") ||
      sp.has("onlyOutsideTolerance") ||
      sp.has("onlyTerminated") ||
      sp.has("onlyDuplicates") ||
      sp.has("onlyDesync") ||
      sp.has("onlyMissingOnGm") ||
      sp.has("onlyMissingOnDi");

    if (urlHasAnyKnown) {
      applyFilterState({
        showRemoved: parseBool(sp.get("showRemoved"), DEFAULTS.showRemoved),
        bacSearch: sp.get("bac") ?? DEFAULTS.bacSearch,
        minAbsDelta: sp.get("minAbsDelta") ?? DEFAULTS.minAbsDelta,
        brandToken: sp.get("brand") ?? DEFAULTS.brandToken,
        productCode: sp.get("productCode") ?? DEFAULTS.productCode,
        onlyOutsideTolerance: parseBool(sp.get("onlyOutsideTolerance"), DEFAULTS.onlyOutsideTolerance),
        onlyTerminated: parseBool(sp.get("onlyTerminated"), DEFAULTS.onlyTerminated),
        onlyDuplicates: parseBool(sp.get("onlyDuplicates"), DEFAULTS.onlyDuplicates),
        onlyDesync: parseBool(sp.get("onlyDesync"), DEFAULTS.onlyDesync),
        onlyMissingOnGm: parseBool(sp.get("onlyMissingOnGm"), DEFAULTS.onlyMissingOnGm),
        onlyMissingOnDi: parseBool(sp.get("onlyMissingOnDi"), DEFAULTS.onlyMissingOnDi),
      });
      hydratedRef.current = true;
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<typeof DEFAULTS>;
        applyFilterState(parsed);
      }
    } catch {
      // ignore
    } finally {
      hydratedRef.current = true;
    }
  }, [DEFAULTS, applyFilterState, searchParams, storageKey]);

  // Sync state -> URL + localStorage
  useEffect(() => {
    if (!hydratedRef.current) return;

    const nextState = {
      showRemoved,
      bacSearch,
      minAbsDelta,
      brandToken,
      productCode,
      onlyOutsideTolerance,
      onlyTerminated,
      onlyDuplicates,
      onlyDesync,
      onlyMissingOnGm,
      onlyMissingOnDi,
    };

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(nextState));
    } catch {
      // ignore
    }

    const sp = new URLSearchParams();
    if (showRemoved !== DEFAULTS.showRemoved) sp.set("showRemoved", String(showRemoved));
    if (bacSearch.trim()) sp.set("bac", bacSearch.trim());
    if (minAbsDelta.trim()) sp.set("minAbsDelta", minAbsDelta.trim());
    if (brandToken.trim()) sp.set("brand", brandToken.trim().toUpperCase());
    if (productCode.trim()) sp.set("productCode", productCode.trim());

    // Non-default toggles
    if (onlyOutsideTolerance !== DEFAULTS.onlyOutsideTolerance) sp.set("onlyOutsideTolerance", String(onlyOutsideTolerance));
    if (onlyTerminated !== DEFAULTS.onlyTerminated) sp.set("onlyTerminated", String(onlyTerminated));
    if (onlyDuplicates !== DEFAULTS.onlyDuplicates) sp.set("onlyDuplicates", String(onlyDuplicates));
    if (onlyDesync !== DEFAULTS.onlyDesync) sp.set("onlyDesync", String(onlyDesync));
    if (onlyMissingOnGm !== DEFAULTS.onlyMissingOnGm) sp.set("onlyMissingOnGm", String(onlyMissingOnGm));
    if (onlyMissingOnDi !== DEFAULTS.onlyMissingOnDi) sp.set("onlyMissingOnDi", String(onlyMissingOnDi));

    const nextUrl = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
    const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    if (nextUrl !== currentUrl) {
      isSyncingUrlRef.current = true;
      router.replace(nextUrl, { scroll: false });
      window.setTimeout(() => {
        isSyncingUrlRef.current = false;
      }, 0);
    }
  }, [
    DEFAULTS,
    pathname,
    router,
    searchParams,
    storageKey,
    showRemoved,
    bacSearch,
    minAbsDelta,
    brandToken,
    productCode,
    onlyOutsideTolerance,
    onlyTerminated,
    onlyDuplicates,
    onlyDesync,
    onlyMissingOnGm,
    onlyMissingOnDi,
  ]);

  // Sync URL -> state when the user lands on a shared link (or manually edits URL).
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (isSyncingUrlRef.current) return;

    const sp = searchParams;
    const urlHasAnyKnown =
      sp.has("showRemoved") ||
      sp.has("bac") ||
      sp.has("minAbsDelta") ||
      sp.has("brand") ||
      sp.has("productCode") ||
      sp.has("onlyOutsideTolerance") ||
      sp.has("onlyTerminated") ||
      sp.has("onlyDuplicates") ||
      sp.has("onlyDesync") ||
      sp.has("onlyMissingOnGm") ||
      sp.has("onlyMissingOnDi");
    if (!urlHasAnyKnown) return;

    applyFilterState({
      showRemoved: parseBool(sp.get("showRemoved"), DEFAULTS.showRemoved),
      bacSearch: sp.get("bac") ?? DEFAULTS.bacSearch,
      minAbsDelta: sp.get("minAbsDelta") ?? DEFAULTS.minAbsDelta,
      brandToken: sp.get("brand") ?? DEFAULTS.brandToken,
      productCode: sp.get("productCode") ?? DEFAULTS.productCode,
      onlyOutsideTolerance: parseBool(sp.get("onlyOutsideTolerance"), DEFAULTS.onlyOutsideTolerance),
      onlyTerminated: parseBool(sp.get("onlyTerminated"), DEFAULTS.onlyTerminated),
      onlyDuplicates: parseBool(sp.get("onlyDuplicates"), DEFAULTS.onlyDuplicates),
      onlyDesync: parseBool(sp.get("onlyDesync"), DEFAULTS.onlyDesync),
      onlyMissingOnGm: parseBool(sp.get("onlyMissingOnGm"), DEFAULTS.onlyMissingOnGm),
      onlyMissingOnDi: parseBool(sp.get("onlyMissingOnDi"), DEFAULTS.onlyMissingOnDi),
    });
  }, [DEFAULTS, applyFilterState, searchParams]);

  const summaryQuery = useQuery({
    queryKey: [
      "run-summary",
      runId,
      showRemoved,
      bacSearch,
      minAbsDelta,
      brandToken,
      productCode,
      onlyOutsideTolerance,
      onlyTerminated,
      onlyDuplicates,
      onlyDesync,
      onlyMissingOnGm,
      onlyMissingOnDi,
    ],
    queryFn: async (): Promise<RunSummaryDto> => {
      const sp = new URLSearchParams();
      if (showRemoved) sp.set("showRemoved", "true");
      if (bacSearch.trim()) sp.set("bac", bacSearch.trim());
      if (minAbsDelta.trim()) sp.set("minAbsDelta", minAbsDelta.trim());
      if (brandToken.trim()) sp.set("brand", brandToken.trim().toUpperCase());
      if (productCode.trim()) sp.set("productCode", productCode.trim());
      if (onlyOutsideTolerance) sp.set("onlyOutsideTolerance", "true");
      if (onlyTerminated) sp.set("onlyTerminated", "true");
      if (onlyDuplicates) sp.set("onlyDuplicates", "true");
      if (onlyDesync) sp.set("onlyDesync", "true");
      if (onlyMissingOnGm) sp.set("onlyMissingOnGm", "true");
      if (onlyMissingOnDi) sp.set("onlyMissingOnDi", "true");
      const res = await fetch(`/api/runs/${runId}/summary?${sp.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load run summary");
      return await res.json();
    },
  });

  const columns = useMemo<MRT_ColumnDef<RunSummaryDto["bacs"][number]>[]>(
    () => [
      {
        accessorKey: "bac",
        header: "BAC",
        size: 110,
        muiTableHeadCellProps: {
          sx: {
            position: "sticky",
            left: 0,
            top: 0,
            zIndex: 4,
            backgroundColor: "background.paper",
          },
        },
        muiTableBodyCellProps: {
          sx: {
            position: "sticky",
            left: 0,
            zIndex: 1,
            backgroundColor: "background.paper",
            fontWeight: 700,
          },
        },
      },
      { accessorKey: "gmTotal", header: "GM total", size: 120 },
      { accessorKey: "diTotal", header: "DI total", size: 120 },
      { accessorKey: "delta", header: "Δ (DI − GM)", size: 140 },
      {
        header: "Flags",
        accessorKey: "flags",
        size: 280,
        Cell: ({ row }) => (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            {row.original.flags
              .filter((f) => f !== "GM_NON_BILLING_ROWS_PRESENT" && f !== "DI_NON_BILLABLE_ROWS_PRESENT")
              // When "Only Δ variances" is enabled, the variance chip is redundant/noisy.
              .filter((f) => !(onlyOutsideTolerance && f === "VARIANCE"))
              .map((f) => {
                const meta = flagChipProps(f);
                return <Chip key={f} size="small" label={meta.label} variant={meta.variant} color={meta.color} />;
              })}
            {row.original.hasRemovedGroups ? (
              (() => {
                const meta = flagChipProps("HAS_REMOVED");
                return <Chip size="small" label={meta.label} variant={meta.variant} color={meta.color} />;
              })()
            ) : null}
          </Stack>
        ),
      },
      { accessorKey: "notesCount", header: "Notes", size: 80 },
    ],
    [onlyOutsideTolerance],
  );

  const data = summaryQuery.data;
  const hasActiveFilters =
    showRemoved ||
    !!bacSearch.trim() ||
    !!minAbsDelta.trim() ||
    !!brandToken.trim() ||
    !!productCode.trim() ||
    onlyOutsideTolerance ||
    onlyTerminated ||
    onlyDuplicates ||
    onlyDesync ||
    onlyMissingOnGm ||
    onlyMissingOnDi;

  const clearFilters = () => {
    applyFilterState(DEFAULTS);
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4" fontWeight={800}>
          Run Results
        </Typography>
        <Typography variant="body2" color="text.secondary">
          BAC-level variance table (Δ = DI − GM). Click a BAC to drill into product-level drivers.
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2} alignItems={{ xs: "stretch", lg: "center" }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Chip label={`# BACs with variance: ${data?.kpis.bacsWithVariance ?? "—"}`} />
          <Chip label={`Total GM $: ${data?.kpis.totalGm ?? "—"}`} />
          <Chip label={`Total DI $: ${data?.kpis.totalDi ?? "—"}`} />
          <Chip label={`Net Δ: ${data?.kpis.netDelta ?? "—"}`} color="primary" variant="outlined" />
        </Stack>

        <Box sx={{ flex: 1 }} />

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <MuiButton
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => {
              window.location.href = `/api/runs/${runId}/export/bac-summary?format=csv&showRemoved=${showRemoved ? "true" : "false"}`;
            }}
          >
            Export CSV
          </MuiButton>
          <MuiButton
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => {
              window.location.href = `/api/runs/${runId}/export/bac-summary?format=xlsx&showRemoved=${showRemoved ? "true" : "false"}`;
            }}
          >
            Export XLSX
          </MuiButton>
          {hasActiveFilters ? (
            <MuiButton variant="text" onClick={clearFilters} data-testid="clear-filters">
              Clear filters
            </MuiButton>
          ) : null}
        </Stack>
      </Stack>

      <Accordion expanded={filtersExpanded} onChange={(_, next) => setFiltersExpanded(next)} variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />} data-testid="filters-toggle">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} sx={{ width: "100%" }}>
            <Typography fontWeight={700}>Filters</Typography>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Tip: start with BAC search, then narrow by brand/product.
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                size="small"
                fullWidth
                label="BAC search"
                value={bacSearch}
                onChange={(e) => setBacSearch(e.target.value)}
                inputProps={{ "data-testid": "bac-search" }}
              />
              <TextField
                size="small"
                fullWidth
                label="Min |Δ|"
                value={minAbsDelta}
                onChange={(e) => setMinAbsDelta(e.target.value)}
                inputProps={{ inputMode: "decimal", "data-testid": "min-abs-delta" }}
              />
              <TextField
                size="small"
                fullWidth
                label="Brand"
                value={brandToken}
                onChange={(e) => setBrandToken(e.target.value)}
                inputProps={{ "data-testid": "brand-filter" }}
                placeholder="C / B / G / BG / CAD / CB / CG / CBG"
              />
              <TextField
                size="small"
                fullWidth
                label="Product code"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                inputProps={{ "data-testid": "product-code-filter" }}
                placeholder="e.g. DI_P1_C"
              />
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
              <FormControlLabel
                control={<Switch checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} />}
                label="Show removed"
              />
              <FormControlLabel
                control={<Switch checked={onlyOutsideTolerance} onChange={(e) => setOnlyOutsideTolerance(e.target.checked)} />}
                label="Only Δ variances"
              />
              <FormControlLabel
                control={<Switch checked={onlyTerminated} onChange={(e) => setOnlyTerminated(e.target.checked)} />}
                label="Only terminated"
              />
              <FormControlLabel
                control={<Switch checked={onlyDuplicates} onChange={(e) => setOnlyDuplicates(e.target.checked)} />}
                label="Only duplicates"
              />
              <FormControlLabel
                control={<Switch checked={onlyDesync} onChange={(e) => setOnlyDesync(e.target.checked)} />}
                label="Only desync"
              />
              <FormControlLabel
                control={<Switch checked={onlyMissingOnGm} onChange={(e) => setOnlyMissingOnGm(e.target.checked)} />}
                label="Only missing on GM"
              />
              <FormControlLabel
                control={<Switch checked={onlyMissingOnDi} onChange={(e) => setOnlyMissingOnDi(e.target.checked)} />}
                label="Only missing on DI"
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
              <MuiButton variant="outlined" onClick={clearFilters} disabled={!hasActiveFilters} data-testid="clear-filters-2">
                Clear all
              </MuiButton>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {!summaryQuery.isLoading && !summaryQuery.isError && (data?.bacs?.length ?? 0) === 0 ? (
        <Alert severity="info" variant="outlined">
          No BACs match the current filters. Try clearing filters, lowering Min |Δ|, or toggling “Show removed”.
        </Alert>
      ) : null}

      <MaterialReactTable
        columns={columns}
        data={data?.bacs ?? []}
        state={{
          isLoading: summaryQuery.isLoading,
          showAlertBanner: summaryQuery.isError,
          showProgressBars: summaryQuery.isFetching,
        }}
        enableStickyHeader
        muiTableHeadCellProps={{
          sx: {
            position: "sticky",
            top: 0,
            zIndex: 2,
            backgroundColor: "background.paper",
          },
        }}
        muiTableContainerProps={{ sx: { overflowX: "auto" } }}
        muiToolbarAlertBannerProps={
          summaryQuery.isError ? { color: "error", children: "Failed to load summary." } : undefined
        }
        enableColumnFilters={false}
        enableDensityToggle={false}
        enableFullScreenToggle={false}
        muiTableBodyRowProps={({ row }) => ({
          onClick: () => router.push(`/runs/${runId}/bacs/${row.original.bac}`),
          sx: { cursor: "pointer" },
          "data-testid": `bac-row-${row.original.bac}`,
        })}
        muiPaginationProps={{ rowsPerPageOptions: [25, 50, 100, 250] }}
        initialState={{ density: "comfortable", pagination: { pageIndex: 0, pageSize: 100 } }}
      />
    </Stack>
  );
}

