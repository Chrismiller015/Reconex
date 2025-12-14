"use client";

import { useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { Alert, Box, Button as MuiButton, Chip, Stack, Tooltip, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import { useSnackbar } from "notistack";

type UploadedFileDto = {
  id: string;
  originalName: string;
  extension: string | null;
  mimeType: string | null;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string | null;
  rowCount: number;
  schemaType: "GM" | "DI" | "UNKNOWN";
  missingFields: { gm: string[]; di: string[] };
};

type ApiErrorShape = { error?: string; code?: string; requestId?: string; details?: unknown };

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function FileLibraryView() {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filesQuery = useQuery({
    queryKey: ["files"],
    queryFn: async (): Promise<UploadedFileDto[]> => {
      const res = await fetch("/api/files", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load files");
      return await res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<UploadedFileDto> => {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/files", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as ApiErrorShape | UploadedFileDto;
      if (!res.ok) {
        const err = json as ApiErrorShape;
        const msg = err.error ?? "Upload failed";
        const rid = err.requestId ? ` (requestId: ${err.requestId})` : "";
        throw new Error(`${msg}${rid}`);
      }
      return json as UploadedFileDto;
    },
    onSuccess: async (uploaded) => {
      if (uploaded.schemaType === "UNKNOWN") {
        enqueueSnackbar("Uploaded, but schema could not be detected (check missing required fields).", { variant: "warning" });
      } else {
        enqueueSnackbar("Upload complete", { variant: "success" });
      }
      await queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (error) => {
      enqueueSnackbar(error instanceof Error ? error.message : "Upload failed", { variant: "error" });
    },
  });

  const columns = useMemo<MRT_ColumnDef<UploadedFileDto>[]>(
    () => [
      { accessorKey: "originalName", header: "File name", size: 260 },
      {
        header: "Type",
        accessorFn: (row) => row.extension?.toUpperCase() ?? "—",
        size: 80,
      },
      {
        header: "Uploaded at",
        accessorFn: (row) => new Date(row.uploadedAt).toLocaleString(),
        size: 190,
      },
      {
        header: "Uploaded by",
        accessorFn: (row) => row.uploadedBy ?? "—",
        size: 160,
      },
      {
        header: "File size",
        accessorFn: (row) => formatBytes(row.sizeBytes),
        size: 120,
      },
      { accessorKey: "rowCount", header: "Row count", size: 100 },
      {
        header: "Detected schema",
        accessorKey: "schemaType",
        Cell: ({ row }) => {
          const schema = row.original.schemaType;
          if (schema !== "UNKNOWN") {
            return <Chip size="small" color={schema === "DI" ? "primary" : "secondary"} label={schema} />;
          }
          const missing = row.original.missingFields;
          return (
            <Tooltip
              title={
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Missing required fields
                  </Typography>
                  <Typography variant="caption" display="block">
                    GM: {missing.gm.join(", ") || "none"}
                  </Typography>
                  <Typography variant="caption" display="block">
                    DI: {missing.di.join(", ") || "none"}
                  </Typography>
                </Box>
              }
            >
              <Chip size="small" color="warning" label="UNKNOWN" />
            </Tooltip>
          );
        },
        size: 160,
      },
      {
        header: "Actions",
        enableSorting: false,
        enableColumnFilter: false,
        size: 120,
        Cell: ({ row }) => (
          <MuiButton
            size="small"
            variant="text"
            startIcon={<DownloadIcon />}
            onClick={() => {
              window.location.href = `/api/files/${row.original.id}/download`;
            }}
          >
            Download
          </MuiButton>
        ),
      },
    ],
    [],
  );

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
        <Box flex={1}>
          <Typography variant="h4" fontWeight={800}>
            File Library
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload DI + GM files to store them for audit and re-download later.
          </Typography>
        </Box>

        <input
          ref={fileInputRef}
          data-testid="file-upload-input"
          type="file"
          hidden
          accept=".csv,.xlsx,.xlsm,.xlsb"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            uploadMutation.mutate(file);
            e.currentTarget.value = "";
          }}
        />
        <MuiButton
          variant="contained"
          startIcon={<CloudUploadIcon />}
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload file
        </MuiButton>
      </Stack>

      <Alert severity="info" variant="outlined">
        Supported file types: <strong>CSV</strong>, <strong>XLSX/XLSM/XLSB</strong>. If a file shows as <strong>UNKNOWN</strong>, hover the chip to see which required
        headers are missing.
      </Alert>

      <MaterialReactTable
        columns={columns}
        data={filesQuery.data ?? []}
        state={{
          isLoading: filesQuery.isLoading,
          showAlertBanner: filesQuery.isError,
          showProgressBars: filesQuery.isFetching,
        }}
        muiTableContainerProps={{ sx: { overflowX: "auto" } }}
        muiToolbarAlertBannerProps={
          filesQuery.isError
            ? { color: "error", children: "Failed to load files. Try refreshing." }
            : undefined
        }
        renderEmptyRowsFallback={() => (
          <Box sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              No files uploaded yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload your DI Billables and GM Billing exports to begin.
            </Typography>
          </Box>
        )}
        initialState={{ density: "comfortable" }}
      />
    </Stack>
  );
}

