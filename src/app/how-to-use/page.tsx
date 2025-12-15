"use client";

import { LinkButton } from "@/components/ui/LinkButton";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BugReportIcon from "@mui/icons-material/BugReport";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DownloadIcon from "@mui/icons-material/Download";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RuleIcon from "@mui/icons-material/Rule";
import { Alert, Card, CardContent, Chip, Container, Divider, Stack, Typography } from "@mui/material";

const SectionTitle = ({ id, children }: { id: string; children: string }) => (
  <Typography
    id={id}
    variant="h4"
    fontWeight={900}
    sx={{
      scrollMarginTop: 96,
      letterSpacing: -0.3,
    }}
  >
    {children}
  </Typography>
);

export default function HowToUsePage() {
  return (
    <Container component="main" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={4} maxWidth={1000}>
        <Stack spacing={1.25}>
          <Typography variant="overline" sx={{ letterSpacing: 1.2, color: "text.secondary" }}>
            How To Use
          </Typography>
          <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: -0.5, lineHeight: 1.1 }}>
            ReconEx — technical guide
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 820 }}>
            This page documents the intended workflow, what the key toggles mean, and how to interpret run results. It’s written to be
            copy/paste-friendly and usable on mobile.
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
            <LinkButton href="/compare/new" variant="contained" endIcon={<ArrowForwardIcon />}>
              Start New Compare
            </LinkButton>
            <LinkButton href="/files" variant="outlined" startIcon={<CloudUploadIcon />}>
              File Library
            </LinkButton>
            <LinkButton href="/runs" variant="text">
              Run Results
            </LinkButton>
          </Stack>
        </Stack>

        <Alert icon={<InfoOutlinedIcon />} severity="info" variant="outlined">
          <strong>Quick reminder:</strong> “Removed” changes the totals — it excludes the variance caused by the product from the BAC and the
          overall run sum, which allows you to “check off” that the variance has been resolved. “DPE Bugged” is a red tag for tracking issues
          where DPE updates wouldn’t apply; it has <strong>no effect</strong> on variance calculations.
        </Alert>

        <Card elevation={0} sx={{ border: 1, borderColor: "divider" }}>
          <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle1" fontWeight={900}>
                Table of contents
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                <LinkButton href="#workflow" variant="text">
                  Workflow
                </LinkButton>
                <LinkButton href="#uploads" variant="text">
                  Uploads & formats
                </LinkButton>
                <LinkButton href="#runs" variant="text">
                  Run Results (BAC-level)
                </LinkButton>
                <LinkButton href="#drilldown" variant="text">
                  BAC drilldown (product-level)
                </LinkButton>
                <LinkButton href="#toggles" variant="text">
                  Removed & DPE Bugged
                </LinkButton>
                <LinkButton href="#filters" variant="text">
                  Filters
                </LinkButton>
                <LinkButton href="#exports" variant="text">
                  Exports
                </LinkButton>
                <LinkButton href="#troubleshooting" variant="text">
                  Troubleshooting
                </LinkButton>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2.5}>
          <SectionTitle id="workflow">Workflow</SectionTitle>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CloudUploadIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={900}>
                      1) Upload files
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Go to <strong>File Library</strong> and upload a DI export and a GM export. ReconEx stores them so you can reuse them for
                    later compares and audits.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CompareArrowsIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={900}>
                      2) Run a compare
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Go to <strong>New Compare</strong>, pick the DI file and GM file, and run the compare. This produces a Run with BAC-level
                    totals and drilldown links.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <RuleIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={900}>
                      3) Triage & resolve
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Use Run Results filters to find what matters, drill into a BAC, then use <strong>Removed</strong>, notes, and{" "}
                    <strong>DPE Bugged</strong> tags to document outcomes.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={2.5}>
          <SectionTitle id="uploads">Uploads & formats</SectionTitle>
          <Stack spacing={1}>
            <Typography variant="body1" color="text.secondary">
              Uploads live under the File Library. ReconEx will detect schema and warn if headers are missing.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label="CSV (DI)" />
              <Chip size="small" label="XLSX/XLSM/XLSB (GM)" />
              <Chip size="small" label="Max upload size configurable" />
            </Stack>
          </Stack>
          <Alert severity="warning" variant="outlined">
            If a file shows as <strong>UNKNOWN</strong>, hover the chip in File Library to see which required headers are missing.
          </Alert>
        </Stack>

        <Divider />

        <Stack spacing={2.5}>
          <SectionTitle id="runs">Run Results (BAC-level)</SectionTitle>
          <Typography variant="body1" color="text.secondary">
            Run Results is the BAC-level variance table. Δ is computed as <strong>DI − GM</strong> after applying removals.
          </Typography>
          <Stack spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={900}>
              What to look at first
            </Typography>
            <Stack spacing={0.75}>
              <Typography variant="body2">- Big Δ values (positive or negative)</Typography>
              <Typography variant="body2">- Flags such as Missing on GM/DI, duplicates, status mismatch, or pricing mismatch</Typography>
              <Typography variant="body2">- “DPE Bugged” tags when you need a dedicated DPE follow-up</Typography>
            </Stack>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={2.5}>
          <SectionTitle id="drilldown">BAC drilldown (product-level)</SectionTitle>
          <Typography variant="body1" color="text.secondary">
            Clicking a BAC opens a drilldown view. The top table shows product groups; the side panels show DI rows and GM rows with highlighting
            to help you match the same product across sources.
          </Typography>
          <Alert severity="info" variant="outlined">
            The “Products causing variance” tab is intentionally focused: it shows only rows with true dollar variance (Δ outside tolerance).
          </Alert>
        </Stack>

        <Divider />

        <Stack spacing={2.5}>
          <SectionTitle id="toggles">Removed & DPE Bugged</SectionTitle>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <RuleIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={900}>
                      Removed
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Use <strong>Removed</strong> when you have confirmed a product should not be included in the variance totals for that BAC.
                    Removed items are excluded from totals and can cause a BAC to disappear from Run Results unless “Show removed” is enabled.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BugReportIcon color="error" />
                    <Typography variant="subtitle1" fontWeight={900}>
                      DPE Bugged
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Use <strong>DPE Bugged</strong> when you attempted to update DPE, but it would not accept changes (even after retrying).
                    This is a red badge for visibility and follow-up routing. It does <strong>not</strong> change variance calculations.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={2.5}>
          <SectionTitle id="filters">Filters</SectionTitle>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FilterAltIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={900}>
                Run Results filters
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Use filters to narrow the BAC list. Common workflows:
            </Typography>
            <Stack spacing={0.75}>
              <Typography variant="body2">- Start with BAC search, then optionally Brand/Product filters</Typography>
              <Typography variant="body2">- “Only bugged” to isolate DPE follow-ups</Typography>
              <Typography variant="body2">- “Show removed” when a BAC disappears because all its variance drivers were removed</Typography>
            </Stack>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={2.5}>
          <SectionTitle id="exports">Exports</SectionTitle>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <DownloadIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={900}>
                CSV/XLSX
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Run Results and BAC drilldown both support exports. Use XLSX exports when you need raw rows and auditing context.
            </Typography>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={2.5}>
          <SectionTitle id="troubleshooting">Troubleshooting</SectionTitle>
          <Stack spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={900}>
              Upload failures
            </Typography>
            <Typography variant="body2" color="text.secondary">
              If the File Library shows “Failed to load files” or uploads fail:
            </Typography>
            <Stack spacing={0.75}>
              <Typography variant="body2">- Confirm your database is reachable (DATABASE_URL)</Typography>
              <Typography variant="body2">- Confirm storage is writable (RECONEX_STORAGE_DIR)</Typography>
              <Typography variant="body2">- Validate file types (CSV/XLSX) and size (RECONEX_MAX_UPLOAD_BYTES)</Typography>
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Container>
  );
}



