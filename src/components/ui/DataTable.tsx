"use client";

import { useMemo } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";

type TeamMember = {
  id: number;
  name: string;
  role: string;
  experience: number;
};

const SAMPLE_MEMBERS: TeamMember[] = [
  { id: 1, name: "Alex Lee", role: "Product Manager", experience: 7 },
  { id: 2, name: "Jordan Lewis", role: "Frontend Engineer", experience: 5 },
  { id: 3, name: "Priya Patel", role: "Backend Engineer", experience: 6 },
  { id: 4, name: "Maria Gonzalez", role: "Designer", experience: 4 },
];

export const DataTable = () => {
  const columns = useMemo<MRT_ColumnDef<TeamMember>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "experience", header: "Years of Experience" },
    ],
    [],
  );

  return (
    <MaterialReactTable
      columns={columns}
      data={SAMPLE_MEMBERS}
      enableColumnFilters
      enableSorting
      initialState={{ density: "comfortable" }}
    />
  );
};
