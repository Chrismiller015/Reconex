import { Card, CardContent, Container, Stack, Typography } from "@mui/material";

export default function SettingsPage() {
  return (
    <Container component="main" sx={{ py: { xs: 3, md: 6 } }}>
      <Stack spacing={2} maxWidth={900}>
        <Typography variant="h4" fontWeight={800}>
          Settings
        </Typography>
        <Card>
          <CardContent>
            <Typography variant="body1" fontWeight={600} gutterBottom>
              Placeholder
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Category values will be configured here in a future iteration.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

