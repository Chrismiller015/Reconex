"use client";

import { Container } from "@mui/material";
import { RunDiffView } from "@/components/runs/RunDiffView";

export default function RunDiffsPage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <RunDiffView />
    </Container>
  );
}



