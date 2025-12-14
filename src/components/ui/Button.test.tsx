import { render, screen } from "@testing-library/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { Button } from "./Button";
import { createAppTheme } from "@/styles/theme";

const renderWithTheme = (ui: React.ReactNode) => {
  return render(
    <ThemeProvider theme={createAppTheme("light")}>
      <CssBaseline />
      {ui}
    </ThemeProvider>,
  );
};

describe("Button", () => {
  it("renders the provided label", () => {
    renderWithTheme(<Button>Submit</Button>);
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("displays a spinner when loading", () => {
    renderWithTheme(
      <Button loading aria-label="loading button">
        Save
      </Button>,
    );
    expect(screen.getByLabelText(/loading button/i)).toBeDisabled();
  });
});
