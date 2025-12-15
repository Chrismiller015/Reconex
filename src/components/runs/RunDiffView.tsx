"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Card,
  CardContent,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Button as MuiButton,
} from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useSnackbar } from "notistack";

type RunListItem = {
  id: string;
  updatedAt: string;
  createdAt: string;
  status: string;
  diFile?: { originalName?: string } | null;
  gmFile?: { originalName?: string } | null;
};

type RunDiffRow = {
  bac: string;
  inRunA: boolean;
  inRunB: boolean;
  gmTotalA: string | null;
  diTotalA: string | null;
  deltaA: string | null;
  openVarianceAbsA: string | null;
  resolvedVarianceAbsA: string | null;
  buggedCountA: number | null;
  removedCountA: number | null;
  notesCountA: number | null;
  gmTotalB: string | null;
  diTotalB: string | null;
  deltaB: string | null;
  openVarianceAbsB: string | null;
  resolvedVarianceAbsB: string | null;
  buggedCountB: number | null;
  removedCountB: number | null;
  notesCountB: number | null;
  deltaChange: string;
  absDeltaChange: number;
};

type RunDiffDto = { runIdA: string; runIdB: string; rows: RunDiffRow[] };

export function RunDiffView() {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const runId = params.id;

  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: async (): Promise<RunListItem[]> => {
      const res = await fetch("/api/runs", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load runs");
      return await res.json();
    },
  });

  const [otherRunId, setOtherRunId] = useState<string>("");

  const diffQuery = useQuery({
    queryKey: ["run-diff", runId, otherRunId],
    enabled: Boolean(otherRunId),
    queryFn: async (): Promise<RunDiffDto> => {
      const res = await fetch(`/api/runs/${runId}/diff?otherRunId=${encodeURIComponent(otherRunId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load run diff");
      return await res.json();
    },
  });

  const importState = useMutation({
    mutationFn: async (payload: { sourceRunId: string; includeNotes: boolean }) => {
      const res = await fetch(`/api/runs/${runId}/state/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to import state");
      return json as { ok: boolean; updatedCount: number; auditCount: number; notesWritten: number };
    },
    onSuccess: async (data) => {
      enqueueSnackbar(`Imported: ${data.updatedCount} updates, ${data.notesWritten} notes`, { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["run-summary", runId] });
      await qc.invalidateQueries({ queryKey: ["run-diff", runId, otherRunId] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to import state", { variant: "error" }),
  });

  const runs = (runsQuery.data ?? []).filter((r) => r.id !== runId);

  const columns = useMemo<MRT_ColumnDef<RunDiffRow>[]>(
    () => [
      { accessorKey: "bac", header: "BAC", size: 110 },
      { accessorKey: "deltaChange", header: "Δ change (A − B)", size: 150 },
      { accessorKey: "deltaA", header: "A Δ", size: 110 },
      { accessorKey: "deltaB", header: "B Δ", size: 110 },
      { accessorKey: "openVarianceAbsA", header: "A remaining", size: 140 },
      { accessorKey: "openVarianceAbsB", header: "B remaining", size: 140 },
      { accessorKey: "buggedCountA", header: "A bugged", size: 100 },
      { accessorKey: "buggedCountB", header: "B bugged", size: 100 },
      { accessorKey: "removedCountA", header: "A removed", size: 110 },
      { accessorKey: "removedCountB", header: "B removed", size: 110 },
      { accessorKey: "notesCountA", header: "A notes", size: 90 },
      { accessorKey: "notesCountB", header: "B notes", size: 90 },
    ],
    [],
  );

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
        <Box sx={{ flex: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
            <Typography variant="h4" fontWeight={900} sx={{ flex: 1 }}>
              Run Diffs
            </Typography>
            <Tabs
              value={1}
              onChange={(_, next) => {
                if (next === 0) router.push(`/runs/${runId}`);
              }}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab label="Results" value={0} />
              <Tab label="Run Diffs" value={1} />
            </Tabs>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Compare this run to another run to see what changed BAC-by-BAC. You can also import reconciliation state (Removed/Bugged/Category/Status
            + Notes) from another run.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <MuiButton variant="outlined" onClick={() => (window.location.href = `/api/runs/${runId}/state/export`)}>
            Export state (JSON)
          </MuiButton>
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="Compare against"
              value={otherRunId}
              onChange={(e) => setOtherRunId(String(e.target.value))}
              sx={{ maxWidth: 720 }}
              helperText="Pick another run to compare to."
            >
              <MenuItem value="">(select a run)</MenuItem>
              {runs.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {`${r.id.slice(0, 8)} • ${new Date(r.updatedAt).toLocaleString()} • DI: ${r.diFile?.originalName ?? "—"} • GM: ${r.gmFile?.originalName ?? "—"}`}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
              <MuiButton
                variant="contained"
                disabled={!otherRunId || importState.isPending}
                onClick={() => {
                  const ok = window.confirm(
                    "Import reconciliation state from the selected run?\n\nThis will overwrite Removed/Bugged/Category/Status for matching products and append notes.",
                  );
                  if (!ok) return;
                  importState.mutate({ sourceRunId: otherRunId, includeNotes: true });
                }}
              >
                Import state from selected run
              </MuiButton>
              <Typography variant="caption" color="text.secondary">
                Tip: use this for day-over-day continuity.
              </Typography>
            </Stack>

            {diffQuery.isError ? (
              <Alert severity="error" variant="outlined">
                Failed to load diff.
              </Alert>
            ) : null}

            <MaterialReactTable
              columns={columns}
              data={diffQuery.data?.rows ?? []}
              state={{ isLoading: diffQuery.isLoading, showProgressBars: diffQuery.isFetching }}
              muiTableContainerProps={{ sx: { overflowX: "auto" } }}
              enableColumnFilters={false}
              enableDensityToggle={false}
              enableFullScreenToggle={false}
              muiTableBodyRowProps={({ row }) => ({
                onClick: () => router.push(`/runs/${runId}/bacs/${row.original.bac}`),
                sx: { cursor: "pointer" },
              })}
              initialState={{ density: "comfortable", pagination: { pageIndex: 0, pageSize: 50 } }}
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}


