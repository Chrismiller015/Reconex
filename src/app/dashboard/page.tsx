"use client";

import { HousingAnalytics } from "@/components/dashboard/HousingAnalytics";
import { Card, CardContent, Container, Stack, Typography } from "@mui/material";

export default function DashboardPage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={4}>
        <Stack spacing={1}>
          <Typography variant="h3" fontWeight={700}>
            Market Intelligence Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary" maxWidth={720}>
            Explore sample KPIs designed for a Texas real-estate team. Datasets are mocked, but the visuals, tables, and
            theming are ready for live data.
          </Typography>
        </Stack>

        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Dataset preview
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Charts below consume a generated five-year monthly dataset. Swap in your own Prisma or API sources via
              TanStack Query to keep this layout intact.
            </Typography>
          </CardContent>
        </Card>

        <HousingAnalytics />
      </Stack>
    </Container>
  );
}
