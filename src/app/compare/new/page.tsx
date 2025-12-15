import { Container } from "@mui/material";
import { NewCompareView } from "@/components/compare/NewCompareView";

// This page uses MUI/React client-side hooks and should not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default function NewComparePage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <NewCompareView />
    </Container>
  );
}



