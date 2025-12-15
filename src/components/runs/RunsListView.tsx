"use client";

import { useMemo, type ComponentProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { Box, Button as MuiButton, Chip, Container, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import ReplayIcon from "@mui/icons-material/Replay";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useSnackbar } from "notistack";

type RunDto = {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETE" | "FAILED";
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  errorMessage: string | null;
  diFile: { id: string; originalName: string };
  gmFile: { id: string; originalName: string };
};

export function RunsListView() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const runsQuery = useQuery({
    queryKey: ["runs"],
    queryFn: async (): Promise<RunDto[]> => {
      const res = await fetch("/api/runs", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load runs");
      return await res.json();
    },
  });

  const rerunMutation = useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`/api/runs/${runId}/rerun`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to rerun");
      return json;
    },
    onSuccess: async () => {
      enqueueSnackbar("Re-run complete", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["runs"] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to rerun", { variant: "error" }),
  });

  const columns = useMemo<MRT_ColumnDef<RunDto>[]>(
    () => [
      { accessorKey: "id", header: "Run id", size: 240 },
      { header: "DI file", accessorFn: (r) => r.diFile.originalName, size: 220 },
      { header: "GM file", accessorFn: (r) => r.gmFile.originalName, size: 220 },
      { header: "Created", accessorFn: (r) => new Date(r.createdAt).toLocaleString(), size: 180 },
      { header: "Last run", accessorFn: (r) => (r.lastRunAt ? new Date(r.lastRunAt).toLocaleString() : "—"), size: 180 },
      {
        header: "Status",
        accessorKey: "status",
        size: 120,
        Cell: ({ row }) => {
          const status = row.original.status;
          const color =
            status === "COMPLETE" ? "success" : status === "FAILED" ? "error" : status === "RUNNING" ? "info" : "default";
          return <Chip size="small" label={status} color={color as never} />;
        },
      },
      {
        header: "Actions",
        enableSorting: false,
        enableColumnFilter: false,
        size: 200,
        Cell: ({ row }) => (
          <Stack direction="row" spacing={1}>
            <MuiButton
              size="small"
              variant="text"
              startIcon={<OpenInNewIcon />}
              data-testid={`run-open-${row.original.id}`}
              onClick={() => router.push(`/runs/${row.original.id}`)}
            >
              Open
            </MuiButton>
            <MuiButton
              size="small"
              variant="text"
              startIcon={<ReplayIcon />}
              disabled={rerunMutation.isPending}
              data-testid={`run-rerun-${row.original.id}`}
              onClick={() => rerunMutation.mutate(row.original.id)}
            >
              Re-run
            </MuiButton>
          </Stack>
        ),
      },
    ],
    [rerunMutation, router],
  );

  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={2}>
      <Box>
        <Typography variant="h4" fontWeight={800}>
          Compare Runs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Each run compares one stored DI file to one stored GM file. You can re-run a comparison without changing its run id.
        </Typography>
      </Box>

      <MaterialReactTable
        columns={columns}
        data={runsQuery.data ?? []}
        state={{
          isLoading: runsQuery.isLoading,
          showAlertBanner: runsQuery.isError,
          showProgressBars: runsQuery.isFetching,
        }}
        muiTableContainerProps={{ sx: { overflowX: "auto" } }}
        muiTableBodyRowProps={({ row }) =>
          ({
            sx: { cursor: "default" },
            "data-testid": `run-row-${row.original.id}`,
          }) as unknown as ComponentProps<"tr">
        }
        muiToolbarAlertBannerProps={
          runsQuery.isError ? { color: "error", children: "Failed to load runs. Try refreshing." } : undefined
        }
        initialState={{ density: "comfortable" }}
      />
      </Stack>
    </Container>
  );
}



