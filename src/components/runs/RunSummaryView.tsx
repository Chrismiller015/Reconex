"use client";

import { useMemo, useState } from "react";
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
import { useParams, useRouter } from "next/navigation";
import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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

  const [showRemoved, setShowRemoved] = useState(false);
  const [bacSearch, setBacSearch] = useState("");
  const [minAbsDelta, setMinAbsDelta] = useState("");
  const [brandToken, setBrandToken] = useState("");
  const [productCode, setProductCode] = useState("");
  const [onlyOutsideTolerance, setOnlyOutsideTolerance] = useState(false);
  const [onlyTerminated, setOnlyTerminated] = useState(false);
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [onlyDesync, setOnlyDesync] = useState(false);
  const [onlyMissingOnGm, setOnlyMissingOnGm] = useState(false);
  const [onlyMissingOnDi, setOnlyMissingOnDi] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

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
      { accessorKey: "bac", header: "BAC", size: 100 },
      { accessorKey: "gmTotal", header: "GM total", size: 120 },
      { accessorKey: "diTotal", header: "DI total", size: 120 },
      { accessorKey: "delta", header: "Δ (DI − GM)", size: 140 },
      {
        header: "Flags",
        accessorKey: "flags",
        size: 280,
        Cell: ({ row }) => (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {row.original.flags.map((f) => (
              <Chip key={f} size="small" label={f} variant="outlined" />
            ))}
            {row.original.hasRemovedGroups ? <Chip size="small" color="warning" label="HAS REMOVED" /> : null}
          </Stack>
        ),
      },
      { accessorKey: "notesCount", header: "Notes", size: 80 },
    ],
    [],
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
    setShowRemoved(false);
    setBacSearch("");
    setMinAbsDelta("");
    setBrandToken("");
    setProductCode("");
    setOnlyOutsideTolerance(false);
    setOnlyTerminated(false);
    setOnlyDuplicates(false);
    setOnlyDesync(false);
    setOnlyMissingOnGm(false);
    setOnlyMissingOnDi(false);
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
        initialState={{ density: "comfortable" }}
      />
    </Stack>
  );
}

