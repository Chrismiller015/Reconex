"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import {
  Alert,
  Box,
  Button as MuiButton,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
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
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<
    Array<{ key: string; file: File; status: "queued" | "uploading" | "success" | "error"; error?: string }>
  >([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

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
  });

  const uploadMany = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const items = files.map((file) => ({
        key: `${file.name}::${file.size}::${file.lastModified}`,
        file,
        status: "queued" as const,
      }));
      setUploadQueue((prev) => [...items, ...prev]);

      if (isProcessingQueue) return;
      setIsProcessingQueue(true);
      try {
        let okCount = 0;
        let failCount = 0;
        for (const item of items) {
          setUploadQueue((prev) => prev.map((x) => (x.key === item.key ? { ...x, status: "uploading", error: undefined } : x)));
          try {
            const uploaded = await uploadMutation.mutateAsync(item.file);
            okCount += 1;
            if (uploaded.schemaType === "UNKNOWN") {
              enqueueSnackbar(`Uploaded ${uploaded.originalName}, but schema could not be detected.`, { variant: "warning" });
            }
            setUploadQueue((prev) => prev.map((x) => (x.key === item.key ? { ...x, status: "success" } : x)));
          } catch (e) {
            failCount += 1;
            const msg = e instanceof Error ? e.message : "Upload failed";
            setUploadQueue((prev) => prev.map((x) => (x.key === item.key ? { ...x, status: "error", error: msg } : x)));
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["files"] });
        if (okCount) enqueueSnackbar(`Uploaded ${okCount} file(s)`, { variant: "success" });
        if (failCount) enqueueSnackbar(`${failCount} upload(s) failed`, { variant: "error" });
      } finally {
        setIsProcessingQueue(false);
      }
    },
    [enqueueSnackbar, isProcessingQueue, queryClient, uploadMutation],
  );

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
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
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
          multiple
          accept=".csv,.xlsx,.xlsm,.xlsb"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (!files.length) return;
            void uploadMany(files);
            e.currentTarget.value = "";
          }}
        />
        <MuiButton
          variant="contained"
          startIcon={<CloudUploadIcon />}
          disabled={isProcessingQueue}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload files
        </MuiButton>
      </Stack>

      <Alert severity="info" variant="outlined">
        Supported file types: <strong>CSV</strong>, <strong>XLSX/XLSM/XLSB</strong>. If a file shows as <strong>UNKNOWN</strong>, hover the chip to see which required
        headers are missing.
      </Alert>

      <Card
        variant="outlined"
        data-testid="file-dropzone"
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.size > 0);
          if (!files.length) return;
          void uploadMany(files);
        }}
        sx={{
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: isDragging ? "primary.main" : "divider",
          backgroundColor: isDragging ? "action.hover" : "background.paper",
          transition: "border-color 120ms ease, background-color 120ms ease",
        }}
      >
        <CardContent sx={{ py: 3 }}>
          <Stack spacing={0.5} alignItems="center">
            <CloudUploadIcon color={isDragging ? "primary" : "action"} />
            <Typography variant="subtitle1" fontWeight={800}>
              Drag & drop DI/GM files here
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Or click “Upload files” to select multiple at once.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {uploadQueue.length ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                <Typography variant="subtitle1" fontWeight={800} sx={{ flex: 1 }}>
                  Upload queue
                </Typography>
                <MuiButton
                  size="small"
                  variant="outlined"
                  disabled={!uploadQueue.some((x) => x.status === "error") || isProcessingQueue}
                  onClick={() => {
                    const failed = uploadQueue.filter((x) => x.status === "error").map((x) => x.file);
                    void uploadMany(failed);
                  }}
                >
                  Retry failed
                </MuiButton>
                <MuiButton
                  size="small"
                  variant="text"
                  disabled={isProcessingQueue}
                  onClick={() => setUploadQueue((prev) => prev.filter((x) => x.status !== "success"))}
                >
                  Clear successful
                </MuiButton>
              </Stack>
              {isProcessingQueue ? <LinearProgress /> : null}
              <Divider />
              <Stack spacing={0.75}>
                {uploadQueue.slice(0, 12).map((u) => (
                  <Stack key={u.key} direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ flex: 1 }} noWrap title={u.file.name}>
                      {u.file.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={u.status}
                      color={u.status === "success" ? "success" : u.status === "error" ? "error" : u.status === "uploading" ? "info" : "default"}
                      variant={u.status === "queued" ? "outlined" : "filled"}
                    />
                    {u.status === "error" ? (
                      <Tooltip title={u.error ?? "Upload failed"}>
                        <Typography variant="caption" color="error" sx={{ maxWidth: 220 }} noWrap>
                          {u.error ?? "Upload failed"}
                        </Typography>
                      </Tooltip>
                    ) : null}
                  </Stack>
                ))}
                {uploadQueue.length > 12 ? (
                  <Typography variant="caption" color="text.secondary">
                    Showing 12 of {uploadQueue.length} queued items.
                  </Typography>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

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
    </Container>
  );
}



