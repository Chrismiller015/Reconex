import { Container } from "@mui/material";
import { BacDrilldownView } from "@/components/runs/BacDrilldownView";

export default function BacDrilldownPage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <BacDrilldownView />
    </Container>
  );
}

