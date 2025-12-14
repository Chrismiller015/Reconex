"use client";

import { MuiChipsInput } from "mui-chips-input";
import { useState } from "react";

export const ChipsInputDemo = () => {
  const [chips, setChips] = useState(["Austin", "Dallas", "Houston"]);

  return (
    <MuiChipsInput
      label="Service areas"
      value={chips}
      onChange={setChips}
      helperText="Add or remove tags — input is persisted in local component state."
      placeholder="Add a city"
      clearInputOnBlur
    />
  );
};
