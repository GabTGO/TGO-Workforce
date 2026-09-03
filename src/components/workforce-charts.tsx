import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  departmentDistribution,
  headcountGrowth,
  headcountTrend,
  monthlyHiringTrend,
  officeDistribution,
  statusDistribution,
  tenureDistribution,
  type Employee,
} from "@/data/employees";

type ChartProps = { employees: Employee[] };

const officeConfig = {
  active: { label: "Active", color: "var(--chart-1)" },
  inactive: { label: "Inactive", color: "var(--chart-3)" },
} satisfies ChartConfig;

const statusConfig = {
  count: { label: "Employees" },
  Active: { label: "Active", color: "var(--chart-1)" },
  Resigned: { label: "Resigned", color: "var(--chart-4)" },
  Terminated: { label: "Terminated", color: "var(--chart-5)" },
} satisfies ChartConfig;

const trendConfig = {
  headcount: { label: "Headcount", color: "var(--chart-2)" },
} satisfies ChartConfig;

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function OfficeDistributionChart({ employees }: ChartProps) {
  const mounted = useMounted();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Office / Location Distribution</CardTitle>
        <CardDescription>Headcount split across delivery hubs</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
        <ChartContainer config={officeConfig} className="h-[280px] w-full">
          <BarChart data={officeDistribution(employees)}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="office" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="active" stackId="a" fill="var(--color-active)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="inactive" stackId="a" fill="var(--color-inactive)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function StatusDistributionChart({ employees }: ChartProps) {
  const mounted = useMounted();
  const data = statusDistribution(employees);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Distribution</CardTitle>
        <CardDescription>Active, resigned and terminated employees</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
        <ChartContainer config={statusConfig} className="mx-auto h-[280px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
            <Pie data={data} dataKey="count" nameKey="status" innerRadius={60} outerRadius={100}>
              {data.map((entry) => (
                <Cell key={entry.status} fill={`var(--color-${entry.status})`} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="status" />} />
          </PieChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function HeadcountTrendChart({ employees }: ChartProps) {
  const mounted = useMounted();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Headcount Trend</CardTitle>
        <CardDescription>Rolling six-month active headcount</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
        <ChartContainer config={trendConfig} className="h-[260px] w-full">
          <LineChart data={headcountTrend(employees)}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="headcount"
              stroke="var(--color-headcount)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const hiringConfig = {
  hires: { label: "Hires", color: "var(--chart-1)" },
  exits: { label: "Exits", color: "var(--chart-4)" },
} satisfies ChartConfig;

const growthConfig = {
  headcount: { label: "Active headcount", color: "var(--chart-2)" },
} satisfies ChartConfig;

const departmentConfig = {
  active: { label: "Active", color: "var(--chart-1)" },
  inactive: { label: "Inactive", color: "var(--chart-3)" },
} satisfies ChartConfig;

const tenureConfig = {
  employees: { label: "Employees", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function MonthlyHiringTrendChart({ employees }: ChartProps) {
  const mounted = useMounted();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Hiring Trend</CardTitle>
        <CardDescription>Hires against exits over the last 12 months</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ChartContainer config={hiringConfig} className="h-[280px] w-full">
            <BarChart data={monthlyHiringTrend(employees)}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="hires" fill="var(--color-hires)" radius={4} />
              <Bar dataKey="exits" fill="var(--color-exits)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function HeadcountGrowthChart({ employees }: ChartProps) {
  const mounted = useMounted();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Headcount Growth</CardTitle>
        <CardDescription>Cumulative active headcount, rolling 12 months</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ChartContainer config={growthConfig} className="h-[280px] w-full">
            <AreaChart data={headcountGrowth(employees)}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="headcount"
                stroke="var(--color-headcount)"
                fill="var(--color-headcount)"
                fillOpacity={0.18}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function DepartmentDistributionChart({ employees }: ChartProps) {
  const mounted = useMounted();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Department Distribution</CardTitle>
        <CardDescription>Workforce split by department</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ChartContainer config={departmentConfig} className="h-[300px] w-full">
            <BarChart data={departmentDistribution(employees)} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
              <YAxis
                type="category"
                dataKey="department"
                tickLine={false}
                axisLine={false}
                width={110}
                fontSize={12}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="active" stackId="d" fill="var(--color-active)" radius={[0, 0, 0, 4]} />
              <Bar dataKey="inactive" stackId="d" fill="var(--color-inactive)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function TenureDistributionChart({ employees }: ChartProps) {
  const mounted = useMounted();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenure Distribution</CardTitle>
        <CardDescription>Active employees grouped by length of service</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <ChartContainer config={tenureConfig} className="h-[280px] w-full">
            <BarChart data={tenureDistribution(employees)}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="band" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="employees" fill="var(--color-employees)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
