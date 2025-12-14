"use client";

import { Card, CardContent, CardHeader, Divider, Stack, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useMemo } from "react";

type HousingDatum = {
  label: string;
  medianPrice: number;
  closedSales: number;
  inventory: number;
};

const generateHousingDataset = (): HousingDatum[] => {
  const start = new Date(2020, 0, 1);
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });

  return Array.from({ length: 60 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const label = `${formatter.format(date)} ${date.getFullYear()}`;
    const medianPrice = Math.round(275_000 + index * 2_150 + 9_000 * Math.sin(index / 5));
    const closedSales = Math.round(2_350 + index * 18 + 210 * Math.cos(index / 4));
    const inventory = parseFloat((2.1 + index * 0.015 + 0.35 * Math.sin(index / 6)).toFixed(2));

    return { label, medianPrice, closedSales, inventory };
  });
};

const metroBreakdown = [
  { city: "Austin", medianPrice: 512_000, yoyChange: 3.6, inventory: 2.4 },
  { city: "Dallas–Fort Worth", medianPrice: 421_000, yoyChange: 2.1, inventory: 2.8 },
  { city: "Houston", medianPrice: 389_000, yoyChange: 1.5, inventory: 3.1 },
  { city: "San Antonio", medianPrice: 354_000, yoyChange: 2.9, inventory: 2.9 },
  { city: "El Paso", medianPrice: 292_000, yoyChange: 4.2, inventory: 2.0 },
];

const metroShare = [
  { label: "Austin", value: 22 },
  { label: "Dallas–Fort Worth", value: 28 },
  { label: "Houston", value: 25 },
  { label: "San Antonio", value: 15 },
  { label: "El Paso", value: 10 },
];

export const HousingAnalytics = () => {
  const dataset = useMemo(() => generateHousingDataset(), []);
  const recent = useMemo(() => dataset.slice(-12), [dataset]);
  return (
    <Stack spacing={4}>
      <Card>
        <CardHeader
          title="Median home price trend"
          subheader="Average single-family closing prices across Texas metros (monthly data, 5-year span)."
        />
        <CardContent>
          <LineChart
            height={320}
            margin={{ right: 24, left: 12, bottom: 36 }}
            dataset={dataset}
            xAxis={[{ dataKey: "label", scaleType: "point", tickInterval: (value, index) => index % 3 === 0 }]}
            series={[
              {
                dataKey: "medianPrice",
                label: "Median price ($)",
                valueFormatter: (value) =>
                  value == null ? "n/a" : `$${Math.round(value).toLocaleString()}`,
              },
            ]}
          />
          <Typography variant="caption" color="text.secondary">
            Peaks in early summer mirror increased demand, while winter dips reflect seasonal slowdowns.
          </Typography>
        </CardContent>
      </Card>

      <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
        <Card sx={{ flex: 1 }}>
          <CardHeader
            title="Closed sales momentum"
            subheader="Last 12 months of transactions across major metros."
          />
          <CardContent>
            <BarChart
              height={300}
              dataset={recent.map((point) => ({
                ...point,
                month: point.label,
              }))}
              xAxis={[{ scaleType: "band", dataKey: "month" }]}
              series={[
                {
                  dataKey: "closedSales",
                  label: "Closed sales",
                  valueFormatter: (value) => (value == null ? "n/a" : value.toLocaleString()),
                },
              ]}
            />
            <Typography variant="caption" color="text.secondary">
              Volume continues to climb despite seasonal dips, supporting the overall appreciation trend.
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardHeader
            title="Metro market share"
            subheader="Percentage of statewide single-family transactions captured by each metro (rolling 12 month)."
          />
          <CardContent>
            <PieChart
              height={300}
              series={[
                {
                  innerRadius: 50,
                  outerRadius: 100,
                  paddingAngle: 1,
                  data: metroShare.map((datum) => ({
                    id: datum.label,
                    value: datum.value,
                    label: datum.label,
                  })),
                },
              ]}
            />
            <Typography variant="caption" color="text.secondary">
              Dallas–Fort Worth leads statewide activity, while Austin and Houston evenly split the second tier.
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      <Card>
        <CardHeader title="Metro snapshot" subheader="Median price, year-over-year change, and inventory levels." />
        <CardContent>
          <Divider />
          <Stack component="ul" spacing={1.5} sx={{ listStyle: "none", mt: 2, p: 0 }}>
            {metroBreakdown.map((metro) => (
              <li key={metro.city}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Typography variant="body1" fontWeight={600}>
                    {metro.city}
                  </Typography>
                  <Stack direction="row" spacing={3}>
                    <Metric label="Median price" value={`$${metro.medianPrice.toLocaleString()}`} />
                    <Metric label="YoY change" value={`${metro.yoyChange.toFixed(1)}%`} />
                    <Metric label="Inventory" value={`${metro.inventory.toFixed(1)} months`} />
                  </Stack>
                </Stack>
                <Divider sx={{ mt: 1.5 }} />
              </li>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <Stack spacing={0.5}>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="subtitle1" fontWeight={600}>
      {value}
    </Typography>
  </Stack>
);
