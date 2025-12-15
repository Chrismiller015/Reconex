"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Container,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  Button as MuiButton,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { PricingTableSettings } from "@/components/settings/PricingTableSettings";

type WorkflowStatusDto = {
  id: string;
  name: string;
  sortOrder: number;
  isClosed: boolean;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

type NoteTemplateDto = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export default function SettingsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const qc = useQueryClient();

  const [tab, setTab] = useState<0 | 1>(0);
  const [newStatus, setNewStatus] = useState({ name: "", sortOrder: "60", isClosed: false, color: "" });
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "" });

  const statusesQuery = useQuery({
    queryKey: ["settings", "workflow-statuses"],
    queryFn: async (): Promise<WorkflowStatusDto[]> => {
      const res = await fetch("/api/settings/workflow-statuses", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load workflow statuses");
      return await res.json();
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["settings", "note-templates"],
    queryFn: async (): Promise<NoteTemplateDto[]> => {
      const res = await fetch("/api/settings/note-templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load note templates");
      return await res.json();
    },
  });

  const createStatus = useMutation({
    mutationFn: async (payload: { name: string; sortOrder: number; isClosed: boolean; color: string | null }) => {
      const res = await fetch("/api/settings/workflow-statuses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to create status");
      return json as WorkflowStatusDto;
    },
    onSuccess: async () => {
      enqueueSnackbar("Status created", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["settings", "workflow-statuses"] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to create status", { variant: "error" }),
  });

  const updateStatus = useMutation({
    mutationFn: async (payload: { id: string; name?: string; sortOrder?: number; isClosed?: boolean; color?: string | null }) => {
      const res = await fetch("/api/settings/workflow-statuses", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to update status");
      return json as WorkflowStatusDto;
    },
    onSuccess: async () => {
      enqueueSnackbar("Status updated", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["settings", "workflow-statuses"] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to update status", { variant: "error" }),
  });

  const deleteStatus = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/workflow-statuses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete status");
      return json as { ok: boolean };
    },
    onSuccess: async () => {
      enqueueSnackbar("Status deleted", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["settings", "workflow-statuses"] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to delete status", { variant: "error" }),
  });

  const createTemplate = useMutation({
    mutationFn: async (payload: { name: string; content: string }) => {
      const res = await fetch("/api/settings/note-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to create template");
      return json as NoteTemplateDto;
    },
    onSuccess: async () => {
      enqueueSnackbar("Template created", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["settings", "note-templates"] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to create template", { variant: "error" }),
  });

  const updateTemplate = useMutation({
    mutationFn: async (payload: { id: string; name?: string; content?: string }) => {
      const res = await fetch("/api/settings/note-templates", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to update template");
      return json as NoteTemplateDto;
    },
    onSuccess: async () => {
      enqueueSnackbar("Template updated", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["settings", "note-templates"] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to update template", { variant: "error" }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/settings/note-templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete template");
      return json as { ok: boolean };
    },
    onSuccess: async () => {
      enqueueSnackbar("Template deleted", { variant: "success" });
      await qc.invalidateQueries({ queryKey: ["settings", "note-templates"] });
    },
    onError: (e) => enqueueSnackbar(e instanceof Error ? e.message : "Failed to delete template", { variant: "error" }),
  });

  const statuses = statusesQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  const hasSettingsError = statusesQuery.isError || templatesQuery.isError;
  const settingsErrorMessage = useMemo(() => {
    if (statusesQuery.isError) return "Failed to load workflow statuses.";
    if (templatesQuery.isError) return "Failed to load note templates.";
    return null;
  }, [statusesQuery.isError, templatesQuery.isError]);

  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={2.5} maxWidth={1000}>
        <Box>
          <Typography variant="h4" fontWeight={900}>
            ReconEx settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Configure workflow statuses, note templates, and pricing rules used during variance investigation.
          </Typography>
        </Box>

        <Tabs
          value={tab}
          onChange={(_, next) => setTab(next as 0 | 1)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ alignSelf: "flex-start" }}
        >
          <Tab label="Workflow" value={0} />
          <Tab label="Pricing Table" value={1} />
        </Tabs>

        {hasSettingsError ? (
          <Alert severity="error" variant="outlined">
            {settingsErrorMessage ?? "Failed to load settings."}
          </Alert>
        ) : null}

        {tab === 0 ? (
          <>
            <Card>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={900}>
                      Workflow statuses
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      These appear on variance items. Closed statuses (like Resolved/Closed) are used for progress metrics.
                    </Typography>
                  </Box>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
                    <TextField
                      size="small"
                      fullWidth
                      label="New status name"
                      value={newStatus.name}
                      onChange={(e) => setNewStatus((p) => ({ ...p, name: e.target.value }))}
                    />
                    <TextField
                      size="small"
                      label="Sort order"
                      value={newStatus.sortOrder}
                      onChange={(e) => setNewStatus((p) => ({ ...p, sortOrder: e.target.value }))}
                      inputProps={{ inputMode: "numeric" }}
                      sx={{ width: { xs: "100%", md: 140 } }}
                    />
                    <TextField
                      size="small"
                      label="Color (optional)"
                      value={newStatus.color}
                      onChange={(e) => setNewStatus((p) => ({ ...p, color: e.target.value }))}
                      placeholder="e.g. info / warning / success"
                      sx={{ width: { xs: "100%", md: 220 } }}
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={newStatus.isClosed}
                          onChange={(e) => setNewStatus((p) => ({ ...p, isClosed: e.target.checked }))}
                        />
                      }
                      label="Closed"
                    />
                    <MuiButton
                      variant="contained"
                      disabled={!newStatus.name.trim() || createStatus.isPending}
                      onClick={() => {
                        const sortOrder = Number(newStatus.sortOrder);
                        createStatus.mutate({
                          name: newStatus.name.trim(),
                          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
                          isClosed: newStatus.isClosed,
                          color: newStatus.color.trim() ? newStatus.color.trim() : null,
                        });
                        setNewStatus({ name: "", sortOrder: "60", isClosed: false, color: "" });
                      }}
                    >
                      Add
                    </MuiButton>
                  </Stack>

                  <Divider />

                  <Stack spacing={1.25}>
                    {statuses.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No statuses found.
                      </Typography>
                    ) : (
                      statuses.map((s) => (
                        <Card key={s.id} variant="outlined">
                          <CardContent sx={{ p: 2 }}>
                            <Stack
                              direction={{ xs: "column", md: "row" }}
                              spacing={1.5}
                              alignItems={{ xs: "stretch", md: "center" }}
                            >
                              <TextField
                                size="small"
                                label="Name"
                                defaultValue={s.name}
                                onBlur={(e) => {
                                  const next = e.target.value.trim();
                                  if (next && next !== s.name) updateStatus.mutate({ id: s.id, name: next });
                                }}
                                sx={{ flex: 1 }}
                              />
                              <TextField
                                size="small"
                                label="Sort"
                                defaultValue={String(s.sortOrder)}
                                onBlur={(e) => {
                                  const next = Number(e.target.value);
                                  if (Number.isFinite(next) && next !== s.sortOrder) updateStatus.mutate({ id: s.id, sortOrder: next });
                                }}
                                inputProps={{ inputMode: "numeric" }}
                                sx={{ width: { xs: "100%", md: 130 } }}
                              />
                              <TextField
                                size="small"
                                label="Color"
                                defaultValue={s.color ?? ""}
                                onBlur={(e) => {
                                  const next = e.target.value.trim() || null;
                                  if ((s.color ?? null) !== next) updateStatus.mutate({ id: s.id, color: next });
                                }}
                                sx={{ width: { xs: "100%", md: 220 } }}
                              />
                              <FormControlLabel
                                control={
                                  <Switch
                                    defaultChecked={s.isClosed}
                                    onChange={(e) => updateStatus.mutate({ id: s.id, isClosed: e.target.checked })}
                                  />
                                }
                                label="Closed"
                              />
                              <MuiButton
                                color="error"
                                onClick={() => {
                                  const ok = window.confirm(`Delete status "${s.name}"?`);
                                  if (!ok) return;
                                  deleteStatus.mutate(s.id);
                                }}
                              >
                                Delete
                              </MuiButton>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={900}>
                      Note templates
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Templates can be inserted into notes from the BAC drilldown.
                    </Typography>
                  </Box>

                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
                      <TextField
                        size="small"
                        fullWidth
                        label="New template name"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))}
                      />
                      <MuiButton
                        variant="contained"
                        disabled={!newTemplate.name.trim() || !newTemplate.content.trim() || createTemplate.isPending}
                        onClick={() => {
                          createTemplate.mutate({ name: newTemplate.name.trim(), content: newTemplate.content.trim() });
                          setNewTemplate({ name: "", content: "" });
                        }}
                      >
                        Add
                      </MuiButton>
                    </Stack>
                    <TextField
                      size="small"
                      label="New template content (HTML)"
                      value={newTemplate.content}
                      onChange={(e) => setNewTemplate((p) => ({ ...p, content: e.target.value }))}
                      multiline
                      minRows={4}
                      placeholder="<p><strong>Example</strong>: ...</p>"
                    />
                  </Stack>

                  <Divider />

                  <Stack spacing={1.25}>
                    {templates.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No templates found.
                      </Typography>
                    ) : (
                      templates.map((t) => (
                        <Card key={t.id} variant="outlined">
                          <CardContent sx={{ p: 2 }}>
                            <Stack spacing={1.25}>
                              <Stack
                                direction={{ xs: "column", md: "row" }}
                                spacing={1.5}
                                alignItems={{ xs: "stretch", md: "center" }}
                              >
                                <TextField
                                  size="small"
                                  label="Name"
                                  defaultValue={t.name}
                                  onBlur={(e) => {
                                    const next = e.target.value.trim();
                                    if (next && next !== t.name) updateTemplate.mutate({ id: t.id, name: next });
                                  }}
                                  sx={{ flex: 1 }}
                                />
                                <MuiButton
                                  color="error"
                                  onClick={() => {
                                    const ok = window.confirm(`Delete template "${t.name}"?`);
                                    if (!ok) return;
                                    deleteTemplate.mutate(t.id);
                                  }}
                                >
                                  Delete
                                </MuiButton>
                              </Stack>
                              <TextField
                                size="small"
                                label="Content (HTML)"
                                defaultValue={t.content}
                                onBlur={(e) => {
                                  const next = e.target.value.trim();
                                  if (next && next !== t.content) updateTemplate.mutate({ id: t.id, content: next });
                                }}
                                multiline
                                minRows={4}
                              />
                            </Stack>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </>
        ) : (
          <PricingTableSettings />
        )}
      </Stack>
    </Container>
  );
}


