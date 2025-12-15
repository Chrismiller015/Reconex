import { Container } from "@mui/material";
import { RunSummaryView } from "@/components/runs/RunSummaryView";

// Force dynamic rendering to avoid build-time prerender issues with MUI in Next.js 14
export const dynamic = "force-dynamic";

export default function RunDetailPage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <RunSummaryView />
    </Container>
  );
}



