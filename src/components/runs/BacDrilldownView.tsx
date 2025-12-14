"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  Box,
  Button as MuiButton,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useSnackbar } from "notistack";

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

  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [lockHighlight, setLockHighlight] = useState(false);
  const [noteTextByKey, setNoteTextByKey] = useState<Record<string, string>>({});
  const [categoryDraftByKey, setCategoryDraftByKey] = useState<Record<string, string>>({});
  const [removedOverrides, setRemovedOverrides] = useState<Record<string, boolean>>({});

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

  const noteMutation = useMutation({
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
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to add note", { variant: "error" }),
  });

  const data = query.data;

  const groupColumns = useMemo<MRT_ColumnDef<DrilldownDto["groups"][number]>[]>(
    () => [
      { accessorKey: "brandToken", header: "Brand", size: 80 },
      { accessorKey: "productCode", header: "Product Code", size: 220 },
      { accessorKey: "diAmount", header: "DI", size: 100 },
      { accessorKey: "gmAmount", header: "GM", size: 100 },
      { accessorKey: "delta", header: "Δ", size: 100 },
      {
        header: "Flags",
        accessorKey: "flags",
        size: 220,
        Cell: ({ row }) => (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {(row.original.flags?.flags ?? []).map((f) => (
              <Chip key={f} size="small" variant="outlined" label={f} />
            ))}
            {row.original.flags?.isVariance ? <Chip size="small" color="primary" label="VARIANCE" /> : null}
          </Stack>
        ),
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
              control={
                <Switch
                  size="small"
                  checked={checked}
                  onChange={(e) => {
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
              onChange={(e) => {
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
          const noteText = noteTextByKey[key] ?? "";
          return (
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary">
                <span data-testid={`notes-count-${key}`}>{g.notesCount} note(s)</span>
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  value={noteText}
                  placeholder="Add note…"
                  inputProps={{ "data-testid": `note-input-${key}` }}
                  onChange={(e) => setNoteTextByKey((prev) => ({ ...prev, [key]: e.target.value }))}
                />
                <MuiButton
                  size="small"
                  variant="outlined"
                  data-testid={`note-add-${key}`}
                  onClick={() => {
                    const text = noteText.trim();
                    if (!text) return;
                    noteMutation.mutate({ bac, brandToken: g.brandToken, productCode: g.productCode, noteText: text });
                    setNoteTextByKey((prev) => ({ ...prev, [key]: "" }));
                  }}
                >
                  Add
                </MuiButton>
              </Stack>
            </Stack>
          );
        },
      },
    ],
    [bac, categoryDraftByKey, categoryMutation, noteMutation, noteTextByKey, removeMutation, removedOverrides],
  );

  const diGroups = useMemo(() => {
    if (!data) return [];
    const byStatus = new Map<string, DrilldownDto["diRows"]>();
    for (const r of data.diRows) {
      const list = byStatus.get(r.status) ?? [];
      list.push(r);
      byStatus.set(r.status, list);
    }
    return [...byStatus.entries()].map(([status, rows]) => ({
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
    return [...byStatus.entries()].map(([status, rows]) => ({
      status,
      rows: rows.sort((a, b) => a.productCode.localeCompare(b.productCode)),
    }));
  }, [data]);

  const setHoverKey = (key: string | null) => {
    if (lockHighlight) return;
    setHighlightKey(key);
  };

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
          <Chip label={`GM total: ${data?.header.gmTotal ?? "—"}`} />
          <Chip label={`DI total: ${data?.header.diTotal ?? "—"}`} />
          <Chip label={`Δ: ${data?.header.delta ?? "—"}`} color="primary" variant="outlined" />
          {(data?.header.flags ?? []).map((f) => (
            <Chip key={f} size="small" variant="outlined" label={f} />
          ))}
        </Stack>
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Switch checked={lockHighlight} onChange={(e) => setLockHighlight(e.target.checked)} />}
          label="Lock highlight"
        />
      </Box>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Products causing variance
          </Typography>
          <MaterialReactTable
            columns={groupColumns}
            data={data?.groups ?? []}
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
              "data-testid": `group-row-${row.original.brandToken}-${row.original.productCode}`,
              "data-brand-token": row.original.brandToken,
              "data-product-code": row.original.productCode,
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
                        {r.exclusionReasons.map((er) => (
                          <Chip key={er} size="small" variant="outlined" label={er} />
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
                        {!r.isBilling ? <Chip size="small" variant="outlined" label="NOT BILLING" /> : null}
                        {r.exclusionReasons.map((er) => (
                          <Chip key={er} size="small" variant="outlined" label={er} />
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
    </Stack>
  );
}

