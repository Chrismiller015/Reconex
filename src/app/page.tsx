"use client";

import { LinkButton } from "@/components/ui/LinkButton";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import FindInPageIcon from "@mui/icons-material/FindInPage";
import { Box, Card, CardContent, Container, Divider, Stack, Typography } from "@mui/material";

export default function HomePage() {
  return (
    <Box component="main">
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          background: (theme) =>
            theme.palette.mode === "light"
              ? `linear-gradient(180deg, ${theme.palette.primary.light}15 0%, ${theme.palette.background.default} 55%, ${theme.palette.background.default} 100%)`
              : `linear-gradient(180deg, ${theme.palette.primary.dark}25 0%, ${theme.palette.background.default} 60%, ${theme.palette.background.default} 100%)`,
        }}
      >
        <Container sx={{ py: { xs: 4, md: 8 } }}>
          <Stack spacing={3} maxWidth={980}>
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AutoAwesomeIcon color="primary" fontSize="small" />
                <Typography variant="overline" sx={{ letterSpacing: 1.2, color: "text.secondary" }}>
                  Welcome
                </Typography>
              </Stack>
              <Typography variant="h2" fontWeight={900} sx={{ letterSpacing: -0.6, lineHeight: 1.05 }}>
                ReconEx
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 760 }}>
                A calm, structured way to reconcile DI and GM billing: upload exports, run a compare, then drill into variances by BAC, brand,
                and product code.
              </Typography>
            </Stack>

            <Card
              elevation={0}
              sx={{
                border: 1,
                borderColor: "divider",
                backgroundColor: "background.paper",
              }}
            >
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <Stack spacing={2.25}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1" fontWeight={800}>
                      Get started
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      If you already have today’s DI + GM exports, start a compare. Otherwise, upload files first.
                    </Typography>
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
                    <LinkButton href="/compare/new" variant="contained" size="large" data-testid="cta-new-compare">
                      Start New Compare
                    </LinkButton>
                    <LinkButton href="/files" variant="outlined" size="large" data-testid="cta-file-library">
                      Open File Library
                    </LinkButton>
                    <LinkButton href="/how-to-use" variant="text" size="large" data-testid="cta-how-to-use">
                      How To Use
                    </LinkButton>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CloudUploadIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight={800}>
                        1) Upload
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Store DI and GM exports in the File Library so you can re-run comparisons without hunting for attachments.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CompareArrowsIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight={800}>
                        2) Compare
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Generate a run that summarizes BAC-level variances and highlights the biggest drivers.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FindInPageIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight={800}>
                        3) Drill down
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Open a BAC to see product-level detail, flags, and row-level context side-by-side.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>

            <Divider />

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <FactCheckIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight={800}>
                        Resolve with confidence
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Use <strong>Removed</strong> to exclude a product from totals, and <strong>DPE Bugged</strong> to tag items where DPE
                      updates wouldn’t stick (no impact on math).
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <Typography variant="subtitle1" fontWeight={800}>
                      Shareable, filterable results
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Run Results are designed for fast triage with filters and exports. When you need to focus, use filters like “Only bugged”.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
