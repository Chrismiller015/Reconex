import { Container } from "@mui/material";
import { RunsListView } from "@/components/runs/RunsListView";

export default function RunsPage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <RunsListView />
    </Container>
  );
}

