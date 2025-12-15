"use client";

import { Container } from "@mui/material";
import { NewCompareView } from "@/components/compare/NewCompareView";

export default function NewComparePage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <NewCompareView />
    </Container>
  );
}



