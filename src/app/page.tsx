import { LinkButton } from "@/components/ui/LinkButton";
import { Card, CardContent, Container, Stack, Typography } from "@mui/material";

export default function HomePage() {
  return (
    <Container component="main" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={4} maxWidth={920}>
        <Stack spacing={1}>
          <Typography variant="h2" fontWeight={800}>
            ReconEx
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Upload DI + GM billing files, run a compare, and drill into variances by BAC, brand, and product code.
          </Typography>
        </Stack>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                Get started
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <LinkButton href="/compare/new" variant="contained" data-testid="cta-new-compare">
                  New Compare
                </LinkButton>
                <LinkButton href="/files" variant="outlined" data-testid="cta-file-library">
                  Go to File Library
                </LinkButton>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
