import { Container } from "@mui/material";
import { RunDiffView } from "@/components/runs/RunDiffView";

// Force dynamic rendering to avoid build-time prerender issues with MUI in Next.js 14
export const dynamic = "force-dynamic";

export default function RunDiffsPage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <RunDiffView />
    </Container>
  );
}



