"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button as MuiButton, Card, CardContent, Divider, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { useRouter } from "next/navigation";

type UploadedFileDto = {
  id: string;
  originalName: string;
  schemaType: "GM" | "DI" | "UNKNOWN";
  uploadedAt: string;
};

type ApiErrorShape = { error?: string; code?: string; requestId?: string; details?: unknown };

export function NewCompareView() {
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [diFileId, setDiFileId] = useState<string>("");
  const [gmFileId, setGmFileId] = useState<string>("");

  const diUploadRef = useRef<HTMLInputElement | null>(null);
  const gmUploadRef = useRef<HTMLInputElement | null>(null);

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
        enqueueSnackbar("Uploaded, but schema could not be detected (see File Library for missing headers).", { variant: "warning" });
      } else {
        enqueueSnackbar("Upload complete", { variant: "success" });
      }
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      if (uploaded.schemaType === "DI") setDiFileId(uploaded.id);
      if (uploaded.schemaType === "GM") setGmFileId(uploaded.id);
    },
    onError: (error) => {
      enqueueSnackbar(error instanceof Error ? error.message : "Upload failed", { variant: "error" });
    },
  });

  const createRunMutation = useMutation({
    mutationFn: async (params: { diFileId: string; gmFileId: string }): Promise<{ id: string }> => {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = (await res.json().catch(() => ({}))) as ApiErrorShape | { id: string };
      if (!res.ok) {
        const err = json as ApiErrorShape;
        const msg = err.error ?? "Failed to create run";
        const rid = err.requestId ? ` (requestId: ${err.requestId})` : "";
        throw new Error(`${msg}${rid}`);
      }
      return json as { id: string };
    },
    onSuccess: (run) => {
      router.push(`/runs/${run.id}`);
    },
    onError: (error) => {
      enqueueSnackbar(error instanceof Error ? error.message : "Failed to create run", { variant: "error" });
    },
  });

  const files = useMemo(() => filesQuery.data ?? [], [filesQuery.data]);
  const diOptions = useMemo(() => files.filter((f) => f.schemaType === "DI"), [files]);
  const gmOptions = useMemo(() => files.filter((f) => f.schemaType === "GM"), [files]);

  const canCompare = !!diFileId && !!gmFileId && !createRunMutation.isPending;

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4" fontWeight={800}>
          New Compare
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select (or upload) both DI and GM files before running a compare.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              Step 1: Select files
            </Typography>
            {diOptions.length === 0 || gmOptions.length === 0 ? (
              <Alert severity="warning" variant="outlined">
                You need at least one detected <strong>DI</strong> file and one detected <strong>GM</strong> file before you can compare. Upload them here or in{" "}
                <strong>File Library</strong>.
              </Alert>
            ) : null}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Stack spacing={1} flex={1}>
                <Typography variant="body2" fontWeight={600}>
                  DI file
                </Typography>
                <TextField
                  select
                  size="small"
                  value={diFileId}
                  onChange={(e) => setDiFileId(e.target.value)}
                  data-testid="select-di-file"
                  disabled={filesQuery.isLoading}
                >
                  <MenuItem value="">Select DI file…</MenuItem>
                  {diOptions.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.originalName}
                    </MenuItem>
                  ))}
                </TextField>
                <input
                  ref={diUploadRef}
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
                  size="small"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => diUploadRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  Upload DI file
                </MuiButton>
              </Stack>

              <Stack spacing={1} flex={1}>
                <Typography variant="body2" fontWeight={600}>
                  GM file
                </Typography>
                <TextField
                  select
                  size="small"
                  value={gmFileId}
                  onChange={(e) => setGmFileId(e.target.value)}
                  data-testid="select-gm-file"
                  disabled={filesQuery.isLoading}
                >
                  <MenuItem value="">Select GM file…</MenuItem>
                  {gmOptions.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.originalName}
                    </MenuItem>
                  ))}
                </TextField>
                <input
                  ref={gmUploadRef}
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
                  size="small"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  onClick={() => gmUploadRef.current?.click()}
                  disabled={uploadMutation.isPending}
                >
                  Upload GM file
                </MuiButton>
              </Stack>
            </Stack>

            <Divider />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="flex-end" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Compare is disabled until both files are selected.
              </Typography>
              <MuiButton
                variant="contained"
                startIcon={<PlayArrowIcon />}
                disabled={!canCompare}
                data-testid="compare-button"
                onClick={() => createRunMutation.mutate({ diFileId, gmFileId })}
              >
                Compare
              </MuiButton>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

