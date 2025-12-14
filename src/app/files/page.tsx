import { Container } from "@mui/material";
import { FileLibraryView } from "@/components/files/FileLibraryView";

export default function FileLibraryPage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <FileLibraryView />
    </Container>
  );
}

