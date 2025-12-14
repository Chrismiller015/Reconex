import { CreatePostForm } from "@/components/forms/CreatePostForm";
import { DataTable } from "@/components/ui/DataTable";
import { PostList } from "@/components/ui/PostList";
import { LinkButton } from "@/components/ui/LinkButton";
import Grid from "@mui/material/Grid";
import { Box, Card, CardContent, Container, Divider, Stack, Typography } from "@mui/material";

export default function HomePage() {
  return (
    <Container component="main" sx={{ py: 6 }}>
      <Stack spacing={6}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={4} alignItems="center">
          <Box flex={1}>
            <Typography variant="h2" gutterBottom>
              ReconEx
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Upload DI + GM billing files, compare totals, and drill into variances by BAC, brand, and product code.
            </Typography>
          </Box>
          <Card sx={{ minWidth: 320 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Quick links</Typography>
                <LinkButton href="/dashboard" variant="contained">
                  Launch dashboard
                </LinkButton>
                <LinkButton href="/components" variant="outlined">
                  Explore components
                </LinkButton>
                <Typography variant="caption" color="text.secondary">
                  Aim these at your internal documentation or component catalog once everything is wired up.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  Create a Post (Server Actions + Prisma)
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Validated with Zod on both client and server, persisted via Prisma, and broadcasted in real-time using
                  Soketi/Pusher.
                </Typography>
                <CreatePostForm />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  Material React Table example
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Pre-configured MRT instance with filtering, sorting, and pagination enabled out of the box.
                </Typography>
                <DataTable />
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h5">Live post feed (React Query + Soketi)</Typography>
                <Typography variant="body2" color="text.secondary">
                  Uses TanStack Query for caching and automatically refreshes when the Create Post form dispatches a Soketi
                  event.
                </Typography>
              </Box>
              <PostList />
            </Stack>
          </CardContent>
        </Card>

        <Divider />
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Tip: the dashboard and components gallery are now fully themed and ready for live data integrations.
        </Typography>
      </Stack>
    </Container>
  );
}
