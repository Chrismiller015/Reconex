"use client";

import { ChipsInputDemo } from "@/components/showcase/ChipsInputDemo";
import { NotificationDemo } from "@/components/showcase/NotificationDemo";
import { DataTable } from "@/components/ui/DataTable";
import { LinkButton } from "@/components/ui/LinkButton";
import Grid from "@mui/material/Grid";
import { Box, Card, CardContent, CardHeader, Container, Divider, Stack, Typography } from "@mui/material";
import dynamic from "next/dynamic";

const RichTextDemo = dynamic(() => import("@/components/showcase/RichTextDemo").then((mod) => mod.RichTextDemo), {
  ssr: false,
  loading: () => (
    <Typography variant="body2" color="text.secondary">
      Loading editor...
    </Typography>
  ),
});

export default function ComponentsPage() {
  return (
    <Container component="main" sx={{ py: 6 }}>
      <Stack spacing={5}>
        <Stack spacing={1}>
          <Typography variant="h3" fontWeight={700}>
            Component Playground
          </Typography>
          <Typography variant="body1" color="text.secondary">
            A curated gallery of reusable UI building blocks wired to ReconEx&#39;s theme, data layer, and notification
            system.
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap">
            <LinkButton href="/dashboard" variant="outlined">
              View dashboard demo
            </LinkButton>
            <LinkButton href="/" variant="text">
              Return home
            </LinkButton>
          </Stack>
        </Stack>

        <Grid container spacing={4}>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Card>
              <CardHeader
                title="Material React Table"
                subheader="Powered by Prisma-backed queries and TanStack Query caching."
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                  This instance reuses the shared `DataTable` component bundled with ReconEx, showcasing customizable
                  columns, filtering, sorting, and pagination.
                </Typography>
                <DataTable />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <Stack spacing={4}>
              <Card>
                <CardHeader title="Chip input" subheader="Powered by mui-chips-input" />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Capture structured tags with keyboard + mouse interactions and built-in validation helpers.
                  </Typography>
                  <ChipsInputDemo />
                </CardContent>
              </Card>

              <Card>
                <CardHeader title="Notifications" subheader="Delivered via notistack" />
                <CardContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Compact, stackable snackbars anchored to the bottom-right corner. Variants inherit palette colors for
                    consistent feedback.
                  </Typography>
                  <NotificationDemo />
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        <Divider />

        <Card>
          <CardHeader
            title="Rich text editor"
            subheader="mui-tiptap wrapped with ReconEx styling"
            sx={{ pb: 0 }}
          />
          <CardContent>
            <Typography variant="body2" color="text.secondary" paragraph>
              Extendable Tiptap editor with Material UI controls. Try selecting text to toggle available formatting, or
              change the heading level from the dropdown.
            </Typography>
            <Box sx={{ "& .MuiPaper-root": { boxShadow: "none" } }}>
              <RichTextDemo />
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
