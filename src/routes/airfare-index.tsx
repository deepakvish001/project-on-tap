import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  Minus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FloatingUtilities } from "@/components/site/FloatingUtilities";
import {
  AIRLINES,
  BASE_PERIOD,
  LATEST_DATE,
  RANGE_OPTIONS,
  ROUTES,
  aggregate,
  buildSeries,
  formatDate,
  routeTable,
  type Frequency,
  type RangeKey,
  type RouteRow,
} from "@/lib/apix-data";

const TITLE = "Airfare Price Index (APIx) — Domestic Airfare Movements | MoSPI";
const DESCRIPTION =
  "Track the APIx Airfare Price Index for India: national index level, daily and monthly changes, route-wise movements, coverage statistics and methodology.";

export const Route = createFileRoute("/airfare-index")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AirfareIndexPage,
});

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const selectClass =
  "h-9 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground";
const PAGE_SIZE = 5;

function pct(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function Delta({ value, className = "" }: { value: number; className?: string }) {
  const Icon = value > 0.05 ? ArrowUpRight : value < -0.05 ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {pct(value)}
    </span>
  );
}

function AirfareIndexPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [routeCode, setRouteCode] = useState("ALL");
  const [airlineCode, setAirlineCode] = useState("ALL");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<keyof RouteRow>("weight");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const days = RANGE_OPTIONS.find((option) => option.key === range)!.days;

  const daily = useMemo(
    () => buildSeries(routeCode, airlineCode, Math.max(days, 60)),
    [routeCode, airlineCode, days],
  );

  const chartData = useMemo(() => {
    const windowed = daily.slice(-days);
    const points = aggregate(windowed, frequency);
    return points.map((point, i) => ({
      ...point,
      prevChange: i === 0 ? 0 : ((point.index - points[i - 1].index) / points[i - 1].index) * 100,
      baseChange: point.index - 100,
    }));
  }, [daily, days, frequency]);

  const latest = daily[daily.length - 1].index;
  const dayAgo = daily[daily.length - 2].index;
  const weekAgo = daily[daily.length - 8].index;
  const monthAgo = daily[daily.length - 31].index;

  const summary = [
    { label: "Daily Change", value: ((latest - dayAgo) / dayAgo) * 100, delta: true },
    { label: "7-Day Change", value: ((latest - weekAgo) / weekAgo) * 100, delta: true },
    { label: "Monthly Change", value: ((latest - monthAgo) / monthAgo) * 100, delta: true },
  ];

  const rows = useMemo(() => routeTable(airlineCode), [airlineCode]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((row) => row.route.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" || typeof bv === "string") {
        return sortAsc
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      return sortAsc ? av - bv : bv - av;
    });
  }, [rows, query, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pagedRows = filteredRows.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE,
  );

  const movement = useMemo(() => {
    const byChange = [...rows].sort((a, b) => b.change - a.change);
    const stable = [...rows].sort((a, b) => Math.abs(a.change) - Math.abs(b.change))[0];
    return { top: byChange[0], bottom: byChange[byChange.length - 1], stable };
  }, [rows]);

  function toggleSort(key: keyof RouteRow) {
    if (key === sortKey) {
      setSortAsc((value) => !value);
    } else {
      setSortKey(key);
      setSortAsc(key === "route");
    }
    setPage(0);
  }

  function resetFilters() {
    setRange("30d");
    setRouteCode("ALL");
    setAirlineCode("ALL");
    setFrequency("daily");
  }

  const totalObservations = rows.reduce((sum, row) => sum + row.observations, 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="flex-1 pb-24">
        {/* Page header */}
        <section className="border-b border-border bg-surface">
          <div className="container-gov py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Statistical Product
            </p>
            <div className="mt-2 flex flex-wrap items-start gap-3">
              <h1 className="text-3xl font-bold text-foreground md:text-4xl">
                Airfare Price Index
              </h1>
              <span
                className="group relative mt-2 inline-flex"
                tabIndex={0}
                role="note"
                aria-label="APIx measures changes in observed domestic airfare prices relative to the selected base period."
              >
                <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="pointer-events-none absolute left-0 top-6 z-20 w-72 rounded-sm border border-border bg-card p-3 text-xs text-muted-foreground opacity-0 shadow-raised transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                  APIx measures changes in observed domestic airfare prices relative to the
                  selected base period.
                </span>
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
              Tracking movements in domestic airfare prices across India
            </p>

            <dl className="mt-6 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {[
                { term: "Latest data date", value: formatDate(LATEST_DATE) },
                { term: "Data status", value: "Available · Updated" },
                { term: "Base period", value: BASE_PERIOD },
                { term: "Base index", value: "100.00" },
              ].map((item) => (
                <div key={item.term} className="bg-background px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    {item.term}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Summary */}
        <section className="container-gov py-8" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="sr-only">
            Index summary
          </h2>
          <div className="grid gap-8 border-b border-border pb-8 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                APIx — National
              </p>
              <p className="mt-2 font-serif text-5xl font-bold tabular-nums text-foreground">
                {latest.toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                <Delta value={latest - 100} className="font-medium text-foreground" /> from base
                period
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-5">
              {summary.map((item) => (
                <div key={item.label} className="bg-background px-4 py-3">
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">
                    <Delta value={item.value} />
                  </dd>
                </div>
              ))}
              <div className="bg-background px-4 py-3">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Observations
                </dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {totalObservations.toLocaleString("en-IN")}
                </dd>
              </div>
              <div className="bg-background px-4 py-3">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Routes Covered
                </dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {rows.length}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Filters */}
        <section className="container-gov" aria-labelledby="filters-heading">
          <div className="rounded-sm border border-border bg-surface">
            <div className="flex items-center justify-between px-4 py-3">
              <h2
                id="filters-heading"
                className="flex items-center gap-2 text-sm font-semibold text-foreground"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filters
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((value) => !value)}
                  aria-expanded={filtersOpen}
                  className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent md:hidden"
                >
                  {filtersOpen ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div
              className={`${filtersOpen ? "grid" : "hidden"} gap-4 border-t border-border px-4 py-4 md:grid md:grid-cols-2 lg:grid-cols-4`}
            >
              <div>
                <label
                  className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
                  htmlFor="filter-period"
                >
                  Time Period
                </label>
                <div id="filter-period" className="flex flex-wrap gap-1" role="group">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={range === option.key}
                      onClick={() => setRange(option.key)}
                      className={`rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        range === option.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-accent"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
                  htmlFor="filter-route"
                >
                  Route
                </label>
                <select
                  id="filter-route"
                  className={selectClass}
                  value={routeCode}
                  onChange={(event) => setRouteCode(event.target.value)}
                >
                  {ROUTES.map((route) => (
                    <option key={route.code} value={route.code}>
                      {route.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
                  htmlFor="filter-airline"
                >
                  Airline
                </label>
                <select
                  id="filter-airline"
                  className={selectClass}
                  value={airlineCode}
                  onChange={(event) => setAirlineCode(event.target.value)}
                >
                  {AIRLINES.map((airline) => (
                    <option key={airline.code} value={airline.code}>
                      {airline.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground"
                  htmlFor="filter-frequency"
                >
                  Frequency
                </label>
                <select
                  id="filter-frequency"
                  className={selectClass}
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value as Frequency)}
                >
                  {FREQUENCIES.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Chart */}
        <section className="container-gov py-8" aria-labelledby="chart-heading">
          <div className="rounded-sm border border-border bg-card p-4 md:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="chart-heading" className="text-lg font-semibold text-foreground">
                Airfare Price Index Trend
              </h2>
              <p className="text-xs text-muted-foreground">
                {ROUTES.find((r) => r.code === routeCode)?.label} ·{" "}
                {AIRLINES.find((a) => a.code === airlineCode)?.label} ·{" "}
                {FREQUENCIES.find((f) => f.key === frequency)?.label}
              </p>
            </div>

            <div className="mt-6 h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => formatDate(value).replace(/ \d{4}$/, "")}
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                    minTickGap={28}
                  />
                  <YAxis
                    domain={["dataMin - 3", "dataMax + 3"]}
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    stroke="var(--color-border)"
                    width={52}
                    label={{
                      value: "APIx",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 12, fill: "var(--color-muted-foreground)" },
                    }}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 4"
                    label={{
                      value: "Base = 100",
                      position: "insideTopRight",
                      style: { fontSize: 11, fill: "var(--color-muted-foreground)" },
                    }}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--color-border)" }} />
                  <Line
                    type="monotone"
                    dataKey="index"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interpretation */}
          <div className="mt-4 rounded-sm border-l-2 border-l-primary border-y border-r border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-foreground">How to read the index</h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              An index value of 100 represents the selected base period. Values above 100 indicate
              higher airfare levels relative to the base period, while values below 100 indicate
              lower levels.
            </p>
            <p className="mt-2 text-sm text-foreground">
              <span className="font-semibold">Example — APIx = 110:</span>{" "}
              <span className="text-muted-foreground">
                Airfare prices are approximately 10% higher than the base-period level.
              </span>
            </p>
          </div>
        </section>

        {/* Route table */}
        <section className="container-gov pb-8" aria-labelledby="routes-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="routes-heading" className="text-lg font-semibold text-foreground">
                Route-wise Airfare Movement
              </h2>
              <p className="text-sm text-muted-foreground">
                Index levels and movements for major city-pair routes.
              </p>
            </div>
            <div className="relative">
              <label htmlFor="route-search" className="sr-only">
                Search routes
              </label>
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="route-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Search route"
                className="h-9 w-56 rounded-sm border border-border bg-background pl-8 pr-3 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-sm border border-border">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <caption className="sr-only">Route-wise airfare index movement</caption>
              <thead className="bg-surface">
                <tr>
                  {(
                    [
                      ["route", "Route", "left"],
                      ["index", "Current Index", "right"],
                      ["change", "Change %", "right"],
                      ["avgFare", "Average Fare", "right"],
                      ["weight", "DGCA Weight", "right"],
                      ["observations", "Observations", "right"],
                    ] as [keyof RouteRow, string, string][]
                  ).map(([key, label, align]) => (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={
                        sortKey === key ? (sortAsc ? "ascending" : "descending") : "none"
                      }
                      className={`border-b border-border px-4 py-2.5 text-${align} text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {label}
                        {sortKey === key ? (
                          sortAsc ? (
                            <ChevronUp className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3 w-3" aria-hidden="true" />
                          )
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr key={row.route} className="border-b border-border last:border-b-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-foreground">
                      {row.route}
                    </th>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {row.index.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      <Delta value={row.change} className="justify-end" />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      ₹{row.avgFare.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {row.weight.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {row.observations.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No routes match your search.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {pagedRows.length} of {filteredRows.length} routes
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(currentPage - 1, 0))}
                disabled={currentPage === 0}
                className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage + 1} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(currentPage + 1, pageCount - 1))}
                disabled={currentPage >= pageCount - 1}
                className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40"
              >
                Next
              </button>
              <a
                href="/route-analytics"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                View Route Intelligence
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* Recent price movement */}
        <section className="container-gov pb-8" aria-labelledby="movement-heading">
          <h2 id="movement-heading" className="text-lg font-semibold text-foreground">
            Recent Price Movement
          </h2>
          <div className="mt-4 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-3">
            {[
              { label: "Highest increase", row: movement.top },
              { label: "Highest decrease", row: movement.bottom },
              { label: "Most stable route", row: movement.stable },
            ].map((item) => (
              <div key={item.label} className="bg-background px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">{item.row.route}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Delta value={item.row.change} /> · Index {item.row.index.toFixed(1)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Data coverage */}
        <section className="container-gov pb-8" aria-labelledby="coverage-heading">
          <div className="grid gap-6 rounded-sm border border-border bg-surface p-4 md:p-6 lg:grid-cols-2">
            <div>
              <h2 id="coverage-heading" className="text-lg font-semibold text-foreground">
                Data Coverage
              </h2>
              <dl className="mt-4 divide-y divide-border border-y border-border">
                {[
                  ["Observation period", "1 January 2024 – 29 August 2026"],
                  ["Number of observations", totalObservations.toLocaleString("en-IN")],
                  ["Number of routes", String(rows.length)],
                  ["Number of airlines", String(AIRLINES.length - 1)],
                  ["Latest update", `${formatDate(LATEST_DATE)}, 06:00 IST`],
                  ["Data source", "Airline booking portals, DGCA traffic statistics"],
                ].map(([term, value]) => (
                  <div key={term} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd className="font-medium tabular-nums text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:content-start">
              <div className="rounded-sm border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-official">
                  Source Data
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Observed airfares and DGCA passenger traffic statistics collected from primary
                  sources without modification.
                </p>
              </div>
              <div className="rounded-sm border border-border bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-analytical">
                  APIx Calculated Indicator
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Index values derived by MoSPI from cleaned source data using the published APIx
                  methodology.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Methodology + downloads */}
        <section className="container-gov pb-12">
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="rounded-sm border border-border bg-card p-4 md:p-6">
              <h2 className="text-lg font-semibold text-foreground">How is APIx calculated?</h2>
              <ol className="mt-4 space-y-1 text-sm">
                {[
                  "Airfare observations",
                  "Data cleaning",
                  "Route-level price indices",
                  "DGCA passenger-based weights",
                  "National Airfare Price Index",
                ].map((step, i, all) => (
                  <li key={step}>
                    <span className="block rounded-sm border border-border bg-surface px-3 py-2 text-foreground">
                      {step}
                    </span>
                    {i < all.length - 1 ? (
                      <span
                        className="block py-1 text-center text-muted-foreground"
                        aria-hidden="true"
                      >
                        ↓
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <a
                href="/methodology"
                className="mt-4 inline-flex items-center gap-1 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                View Methodology
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="rounded-sm border border-border bg-surface p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Download className="h-4 w-4" aria-hidden="true" />
                Download Data
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {["CSV", "Excel", "JSON"].map((format) => (
                  <button
                    key={format}
                    type="button"
                    className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    {format}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 w-full rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Download Chart (PNG)
              </button>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Downloads reflect the currently applied filters.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <FloatingUtilities />
    </div>
  );
}

type TooltipPayload = {
  payload: { date: string; index: number; prevChange: number; baseChange: number };
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-sm border border-border bg-card p-3 text-xs shadow-raised">
      <p className="font-semibold text-foreground">{formatDate(point.date)}</p>
      <dl className="mt-2 space-y-1">
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">APIx</dt>
          <dd className="tabular-nums font-medium text-foreground">{point.index.toFixed(2)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">Change from previous</dt>
          <dd className="tabular-nums text-foreground">{pct(point.prevChange, 2)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">Change from base</dt>
          <dd className="tabular-nums text-foreground">{pct(point.baseChange, 2)}</dd>
        </div>
      </dl>
    </div>
  );
}
