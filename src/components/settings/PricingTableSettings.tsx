"use client";

import { useMemo, useRef, useState, type InputHTMLAttributes } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { Alert, Box, Button as MuiButton, Card, CardContent, Divider, Stack, Switch, TextField, Typography } from "@mui/material";
import { useSnackbar } from "notistack";

type PricingTableVersionDto = {
  id: string;
  createdAt: string;
  createdByEmail: string | null;
  createdByName: string | null;
  sourceFilename: string | null;
  sourceSha256: string | null;
  isActive: boolean;
} | null;

type PricingRowDto = {
  id: string;
  productCode: string;
  pricingTableId: string;
  active: boolean;
  diBrandName: string;
  websiteTier: string;
  invoiceGroup: string;
  dealerPriceCurrency: string;
  dealerPrice: string; // decimal string
  oemProductCode: string;
};

type PricingRowPatch = Partial<Omit<PricingRowDto, "id">>;

type AuditEventDto = {
  id: string;
  createdAt: string;
  action: "UPLOAD" | "EDIT";
  actorEmail: string | null;
  actorName: string | null;
  field: string | null;
  prev: unknown | null;
  next: unknown | null;
  message: string | null;
};

export function PricingTableSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [draftPatchById, setDraftPatchById] = useState<Record<string, PricingRowPatch>>({});

  const pricingQuery = useQuery({
    queryKey: ["settings", "pricing-table"],
    queryFn: async (): Promise<{ version: PricingTableVersionDto; rows: PricingRowDto[] }> => {
      const res = await fetch("/api/settings/pricing-table", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to load pricing table");
      return json as { version: PricingTableVersionDto; rows: PricingRowDto[] };
    },
  });

  const versionId = pricingQuery.data?.version?.id ?? null;

  const auditQuery = useQuery({
    queryKey: ["settings", "pricing-table", "audit", versionId],
    enabled: Boolean(versionId),
    queryFn: async (): Promise<{ versionId: string; events: AuditEventDto[] }> => {
      const res = await fetch(`/api/settings/pricing-table/audit?versionId=${encodeURIComponent(versionId!)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to load audit feed");
      return json as { versionId: string; events: AuditEventDto[] };
    },
  });

  const rows = useMemo<PricingRowDto[]>(() => pricingQuery.data?.rows ?? [], [pricingQuery.data?.rows]);
  const originalById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const tableData = useMemo(() => rows.map((r) => ({ ...r, ...(draftPatchById[r.id] ?? {}) })), [rows, draftPatchById]);

  const dirtyEdits = useMemo(() => {
    const edits: Array<{ id: string; patch: Partial<PricingRowDto> }> = [];
    for (const [id, patchDraft] of Object.entries(draftPatchById)) {
      const orig = originalById.get(id);
      if (!orig) continue;
      const patch: Partial<PricingRowDto> = {};
      const cmp = <K extends keyof PricingRowPatch>(k: K) => {
        const next = patchDraft[k];
        if (next === undefined) return;
        if (String(orig[k]) !== String(next)) {
          (patch as Record<string, unknown>)[k] = next;
        }
      };
      cmp("productCode");
      cmp("pricingTableId");
      cmp("active");
      cmp("diBrandName");
      cmp("websiteTier");
      cmp("invoiceGroup");
      cmp("dealerPriceCurrency");
      cmp("dealerPrice");
      cmp("oemProductCode");
      if (Object.keys(patch).length) edits.push({ id, patch });
    }
    return edits;
  }, [draftPatchById, originalById]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { edits: Array<{ id: string; patch: Record<string, unknown> }> }) => {
      const res = await fetch("/api/settings/pricing-table", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to save pricing table");
      return json as { ok: boolean; versionId: string };
    },
    onSuccess: async () => {
      enqueueSnackbar("Pricing table saved", { variant: "success" });
      setDraftPatchById({});
      await qc.invalidateQueries({ queryKey: ["settings", "pricing-table"] });
      // Audit depends on version id so just invalidate broadly.
      await qc.invalidateQueries({ queryKey: ["settings", "pricing-table", "audit"] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to save pricing table", { variant: "error" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/settings/pricing-table/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to upload pricing table");
      return json as { ok: boolean; versionId: string; rowCount: number; droppedDuplicates?: number };
    },
    onSuccess: async (r) => {
      const dropped = Number(r.droppedDuplicates ?? 0);
      enqueueSnackbar(`Pricing table uploaded (${r.rowCount} rows${dropped ? `; dropped ${dropped} duplicates` : ""})`, {
        variant: "success",
      });
      setDraftPatchById({});
      await qc.invalidateQueries({ queryKey: ["settings", "pricing-table"] });
      await qc.invalidateQueries({ queryKey: ["settings", "pricing-table", "audit"] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to upload pricing table", { variant: "error" }),
  });

  const updateDraft = (id: string, patch: PricingRowPatch) => {
    setDraftPatchById((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
  };

  const columns = useMemo<MRT_ColumnDef<PricingRowDto>[]>(
    () => [
      {
        accessorKey: "productCode",
        header: "Product Code",
        size: 160,
        Cell: ({ row }) => {
          const r = row.original;
          return (
            <TextField
              size="small"
              value={r.productCode}
              onChange={(e) => updateDraft(r.id, { productCode: e.target.value })}
              inputProps={{ "data-testid": `pricing-productCode-${r.id}` }}
            />
          );
        },
      },
      {
        accessorKey: "websiteTier",
        header: "Website Tier",
        size: 140,
        Cell: ({ row }) => {
          const r = row.original;
          return (
            <TextField
              size="small"
              value={r.websiteTier}
              onChange={(e) => updateDraft(r.id, { websiteTier: e.target.value })}
              inputProps={{ "data-testid": `pricing-websiteTier-${r.id}` }}
            />
          );
        },
      },
      {
        accessorKey: "active",
        header: "Active",
        size: 90,
        Cell: ({ row }) => {
          const r = row.original;
          return (
            <Switch
              size="small"
              checked={Boolean(r.active)}
              onChange={(e) => updateDraft(r.id, { active: e.target.checked })}
              inputProps={{ "data-testid": `pricing-active-${r.id}` } as InputHTMLAttributes<HTMLInputElement>}
            />
          );
        },
      },
      {
        accessorKey: "dealerPrice",
        header: "Dealer Price",
        size: 120,
        Cell: ({ row }) => {
          const r = row.original;
          return (
            <TextField
              size="small"
              value={r.dealerPrice}
              onChange={(e) => updateDraft(r.id, { dealerPrice: e.target.value })}
              inputProps={{ inputMode: "decimal", "data-testid": `pricing-dealerPrice-${r.id}` }}
            />
          );
        },
      },
      {
        accessorKey: "dealerPriceCurrency",
        header: "Currency",
        size: 100,
        Cell: ({ row }) => {
          const r = row.original;
          return (
            <TextField
              size="small"
              value={r.dealerPriceCurrency}
              onChange={(e) => updateDraft(r.id, { dealerPriceCurrency: e.target.value })}
              inputProps={{ "data-testid": `pricing-currency-${r.id}` }}
            />
          );
        },
      },
      {
        accessorKey: "pricingTableId",
        header: "Pricing Table ID",
        size: 170,
        Cell: ({ row }) => {
          const r = row.original;
          return (
            <TextField
              size="small"
              value={r.pricingTableId}
              onChange={(e) => updateDraft(r.id, { pricingTableId: e.target.value })}
              inputProps={{ "data-testid": `pricing-pricingTableId-${r.id}` }}
            />
          );
        },
      },
      {
        accessorKey: "diBrandName",
        header: "DI Brand Name",
        size: 160,
        Cell: ({ row }) => {
          const r = row.original;
          return (
            <TextField
              size="small"
              value={r.diBrandName}
              onChange={(e) => updateDraft(r.id, { diBrandName: e.target.value })}
              inputProps={{ "data-testid": `pricing-diBrandName-${r.id}` }}
            />
          );
        },
      },
      {
        accessorKey: "invoiceGroup",
        header: "Invoice Group",
        size: 140,
        Cell: ({ row }) => {
          const r = row.original;
          return (
            <TextField
              size="small"
              value={r.invoiceGroup}
              onChange={(e) => updateDraft(r.id, { invoiceGroup: e.target.value })}
              inputProps={{ "data-testid": `pricing-invoiceGroup-${r.id}` }}
            />
          );
        },
      },
      {
        accessorKey: "oemProductCode",
        header: "OEM Product Code",
        size: 150,
        Cell: ({ row }) => {
          const r = row.original;
          return (
            <TextField
              size="small"
              value={r.oemProductCode}
              onChange={(e) => updateDraft(r.id, { oemProductCode: e.target.value })}
              inputProps={{ "data-testid": `pricing-oemProductCode-${r.id}` }}
            />
          );
        },
      },
    ],
    [],
  );

  const versionMeta = pricingQuery.data?.version;
  const versionLabel = versionMeta
    ? `${new Date(versionMeta.createdAt).toLocaleString()}${versionMeta.sourceFilename ? ` • ${versionMeta.sourceFilename}` : ""}`
    : "No pricing table loaded yet.";

  return (
    <Stack spacing={2}>
      {pricingQuery.isError ? (
        <Alert severity="error" variant="outlined">
          {pricingQuery.error instanceof Error ? pricingQuery.error.message : "Failed to load pricing table."}
        </Alert>
      ) : null}

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
          <Stack spacing={1.25}>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                Pricing Table
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {versionLabel}
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (!f) return;
                  uploadMutation.mutate(f);
                  // allow re-uploading the same file by resetting
                  e.currentTarget.value = "";
                }}
              />
              <MuiButton variant="outlined" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                Upload new CSV (overwrite)
              </MuiButton>
              <Box sx={{ flex: 1 }} />
              <MuiButton
                variant="contained"
                disabled={saveMutation.isPending || dirtyEdits.length === 0 || pricingQuery.isLoading}
                onClick={() => {
                  const edits = dirtyEdits.map((e) => ({ id: e.id, patch: e.patch as Record<string, unknown> }));
                  saveMutation.mutate({ edits });
                }}
              >
                Save changes ({dirtyEdits.length})
              </MuiButton>
            </Stack>

            <Divider />

            <MaterialReactTable
              columns={columns}
              data={tableData}
              state={{ isLoading: pricingQuery.isLoading, showProgressBars: pricingQuery.isFetching }}
              enablePagination
              enableColumnFilters
              enableDensityToggle={false}
              enableFullScreenToggle={false}
              getRowId={(row) => row.id}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
          <Stack spacing={1}>
            <Typography variant="h6" fontWeight={900}>
              Audit history
            </Typography>
            {auditQuery.isError ? (
              <Alert severity="error" variant="outlined">
                {auditQuery.error instanceof Error ? auditQuery.error.message : "Failed to load audit history."}
              </Alert>
            ) : null}

            {(auditQuery.data?.events ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No audit events yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {(auditQuery.data?.events ?? []).slice(0, 50).map((e) => (
                  <Box key={e.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.25 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {e.action} • {new Date(e.createdAt).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(e.actorName || e.actorEmail) ?? "Unknown user"}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {e.message ?? e.field ?? "—"}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}


