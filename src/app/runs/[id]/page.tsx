import { Container } from "@mui/material";
import { RunSummaryView } from "@/components/runs/RunSummaryView";

export default function RunDetailPage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <RunSummaryView />
    </Container>
  );
}

