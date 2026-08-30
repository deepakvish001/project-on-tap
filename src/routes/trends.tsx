import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
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
  type Frequency,
  type RangeKey,
} from "@/lib/apix-data";
import { routeIntel } from "@/lib/route-intel";

const TITLE = "Price Trends — Domestic Airfare Movements Over Time | APIx, MoSPI";
const DESCRIPTION =
  "Analyse how Indian domestic airfares change over time: average and median fare trends, APIx movement, airline and route trends, period comparison and historical data.";

export const Route = createFileRoute("/trends")({
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
  component: PriceTrendsPage,
});

const selectClass =
  "h-9 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground";
const PAGE_SIZE = 10;
const BASE_FARE_ALL = 4680;

const MEASURES = [
  { key: "avgFare", label: "Average Fare" },
  { key: "medianFare", label: "Median Fare" },
  { key: "index", label: "Airfare Index" },
] as const;
type MeasureKey = (typeof MEASURES)[number]["key"];

const FREQUENCIES: { key: Frequency; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

type SortKey = "date" | "avgFare" | "medianFare" | "index" | "change" | "observations";
type RouteSort = "increase" | "decrease" | "fare" | "weight";

function pct(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function Delta({ value }: { value: number }) {
  const Icon = value > 0.05 ? ArrowUpRight : value < -0.05 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      {pct(value)}
    </span>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded-sm border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </span>
  );
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function shiftDate(days: number) {
  return new Date(new Date(`${LATEST_DATE}T00:00:00Z`).getTime() - days * 86400000)
    .toISOString()
    .slice(0, 10);
}

type TrendPoint = {
  date: string;
  index: number;
  avgFare: number;
  medianFare: number;
  change: number;
  observations: number;
};

function PriceTrendsPage() {
  const [range, setRange] = useState<RangeKey | "custom">("30d");
  const [customFrom, setCustomFrom] = useState(shiftDate(60));
  const [customTo, setCustomTo] = useState(LATEST_DATE);
  const [routeCode, setRouteCode] = useState("ALL");
  const [airlineCode, setAirlineCode] = useState("ALL");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [measure, setMeasure] = useState<MeasureKey>("avgFare");
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>(["6E", "AI", "SG"]);
  const [routeSort, setRouteSort] = useState<RouteSort>("increase");

  const [periodA, setPeriodA] = useState({ from: shiftDate(29), to: shiftDate(15) });
  const [periodB, setPeriodB] = useState({ from: shiftDate(14), to: LATEST_DATE });

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const days = useMemo(() => {
    if (range !== "custom") return RANGE_OPTIONS.find((o) => o.key === range)!.days;
    const from = new Date(`${customFrom}T00:00:00Z`).getTime();
    const to = new Date(`${customTo}T00:00:00Z`).getTime();
    return Math.max(2, Math.min(730, Math.round((to - from) / 86400000) + 1));
  }, [range, customFrom, customTo]);

  const baseFare = useMemo(() => {
    if (routeCode === "ALL") return BASE_FARE_ALL;
    const row = routeIntel(airlineCode).find((r) => r.code === routeCode);
    return row?.baseFare ?? BASE_FARE_ALL;
  }, [routeCode, airlineCode]);

  const points: TrendPoint[] = useMemo(() => {
    const daily = buildSeries(routeCode, airlineCode, Math.max(days, 40)).slice(-days);
    const series = aggregate(daily, frequency);
    return series.map((point, i, arr) => {
      const avgFare = (baseFare * point.index) / 100;
      return {
        date: point.date,
        index: point.index,
        avgFare: Math.round(avgFare),
        medianFare: Math.round(avgFare * 0.968),
        change: i === 0 ? 0 : ((point.index - arr[i - 1]!.index) / arr[i - 1]!.index) * 100,
        observations:
          frequency === "daily" ? 1200 + Math.round(point.index * 6) : frequency === "weekly" ? 8400 + Math.round(point.index * 34) : 36000 + Math.round(point.index * 140),
      };
    });
  }, [routeCode, airlineCode, days, frequency, baseFare]);

  const dailyFull = useMemo(
    () => buildSeries(routeCode, airlineCode, 380),
    [routeCode, airlineCode],
  );

  function periodStats(period: { from: string; to: string }) {
    const rows = dailyFull.filter((p) => p.date >= period.from && p.date <= period.to);
    if (rows.length === 0) return { index: 0, fare: 0, count: 0 };
    const index = rows.reduce((sum, p) => sum + p.index, 0) / rows.length;
    return { index, fare: (baseFare * index) / 100, count: rows.length };
  }

  const statsA = periodStats(periodA);
  const statsB = periodStats(periodB);
  const fareChange = statsA.fare ? ((statsB.fare - statsA.fare) / statsA.fare) * 100 : 0;
  const indexChange = statsB.index - statsA.index;

  const airlineRows = useMemo(
    () =>
      AIRLINES.filter((a) => a.code !== "ALL").map((airline) => {
        const series = buildSeries(routeCode, airline.code, Math.max(days, 40)).slice(-days);
        const first = series[0]!.index;
        const last = series[series.length - 1]!.index;
        return {
          code: airline.code,
          label: airline.label,
          avgFare: Math.round((baseFare * last) / 100),
          coverage: Math.max(4, Math.round(airline.factor * 11)),
          observations: 3200 + Math.round(airline.factor * 2400),
          change: ((last - first) / first) * 100,
          index: last,
        };
      }),
    [routeCode, days, baseFare],
  );

  const airlineChart = useMemo(() => {
    const codes = selectedAirlines.length ? selectedAirlines : ["6E"];
    const base = aggregate(
      buildSeries(routeCode, codes[0]!, Math.max(days, 40)).slice(-days),
      frequency,
    );
    return base.map((point, i) => {
      const row: Record<string, number | string> = { date: point.date };
      for (const code of codes) {
        const series = aggregate(
          buildSeries(routeCode, code, Math.max(days, 40)).slice(-days),
          frequency,
        );
        row[code] = Math.round((baseFare * (series[i]?.index ?? point.index)) / 100);
      }
      return row;
    });
  }, [selectedAirlines, routeCode, days, frequency, baseFare]);

  const routeRows = useMemo(() => {
    const rows = routeIntel(airlineCode);
    const sorters: Record<RouteSort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      increase: (a, b) => b.change - a.change,
      decrease: (a, b) => a.change - b.change,
      fare: (a, b) => b.avgFare - a.avgFare,
      weight: (a, b) => b.weight - a.weight,
    };
    return [...rows].sort(sorters[routeSort]);
  }, [airlineCode, routeSort]);

  const allRoutes = useMemo(() => routeIntel(airlineCode), [airlineCode]);
  const highlights = useMemo(() => {
    const byChange = [...allRoutes].sort((a, b) => b.change - a.change);
    const stable = [...allRoutes].sort((a, b) => Math.abs(a.change) - Math.abs(b.change))[0]!;
    const expensive = [...allRoutes].sort((a, b) => b.avgFare - a.avgFare)[0]!;
    const airline = [...airlineRows].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0]!;
    return [
      { term: "Largest fare increase", value: `${byChange[0]!.route} · ${pct(byChange[0]!.change)}` },
      { term: "Largest fare decrease", value: `${byChange[byChange.length - 1]!.route} · ${pct(byChange[byChange.length - 1]!.change)}` },
      { term: "Highest average fare", value: `${expensive.route} · ${inr(expensive.avgFare)}` },
      { term: "Most stable route", value: `${stable.route} · ${pct(stable.change)}` },
      { term: "Largest airline movement", value: `${airline.label} · ${pct(airline.change)}` },
    ];
  }, [allRoutes, airlineRows]);

  const tableRows = useMemo(() => {
    const rows = points.filter((row) => row.date.includes(query.trim()));
    return [...rows].sort((a, b) => {
      if (sortKey === "date") return sortAsc ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      return sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey];
    });
  }, [points, query, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageRows = tableRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalObservations = points.reduce((sum, row) => sum + row.observations, 0);

  function resetFilters() {
    setRange("30d");
    setRouteCode("ALL");
    setAirlineCode("ALL");
    setFrequency("daily");
    setQuery("");
    setPage(0);
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((value) => !value);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(0);
  }

  function toggleAirline(code: string) {
    setSelectedAirlines((list) =>
      list.includes(code)
        ? list.length > 1
          ? list.filter((item) => item !== code)
          : list
        : list.length < 4
          ? [...list, code]
          : list,
    );
  }

  function exportTrend(format: "csv" | "xls" | "json") {
    const name = `apix-trend-${LATEST_DATE}`;
    if (format === "json") {
      download(`${name}.json`, JSON.stringify(tableRows, null, 2), "application/json");
      return;
    }
    const header = ["Date", "Average Fare (INR)", "Median Fare (INR)", "APIx", "Change %", "Observations"];
    const body = [header, ...tableRows.map((row) => [row.date, row.avgFare, row.medianFare, row.index, row.change.toFixed(2), row.observations])]
      .map((cells) => cells.join(","))
      .join("\n");
    download(
      `${name}.${format === "csv" ? "csv" : "xls"}`,
      body,
      format === "csv" ? "text/csv" : "application/vnd.ms-excel",
    );
  }

  const th = "px-3 py-2 text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground";
  const td = "px-3 py-2 text-sm text-foreground";
  const airlineColors = ["text-primary", "text-saffron", "text-navy", "text-muted-foreground"];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main id="main-content" className="flex-1 pb-28">
        {/* Header */}
        <section className="border-b border-border bg-surface">
          <div className="container-gov py-8">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">Price Trends</h1>
              <Tag>APIx Calculated</Tag>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
              Explore changes in domestic airfare prices across time, routes and airlines.
            </p>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Analyse historical airfare movements and identify periods and routes experiencing
              significant price changes.
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="container-gov pt-8" aria-labelledby="trend-filters">
          <div className="rounded-sm border border-border bg-surface">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 id="trend-filters" className="flex items-center gap-2 text-sm font-semibold text-foreground">
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
            <div className={`${filtersOpen ? "grid" : "hidden"} gap-4 border-t border-border px-4 py-4 md:grid md:grid-cols-2 lg:grid-cols-4`}>
              <div>
                <label htmlFor="t-range" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Date Range
                </label>
                <select id="t-range" className={selectClass} value={range} onChange={(e) => setRange(e.target.value as RangeKey | "custom")}>
                  {RANGE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
                {range === "custom" ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      aria-label="Custom range start"
                      value={customFrom}
                      max={customTo}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className={selectClass}
                    />
                    <input
                      type="date"
                      aria-label="Custom range end"
                      value={customTo}
                      max={LATEST_DATE}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className={selectClass}
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <label htmlFor="t-route" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Route
                </label>
                <select id="t-route" className={selectClass} value={routeCode} onChange={(e) => setRouteCode(e.target.value)}>
                  {ROUTES.map((route) => (
                    <option key={route.code} value={route.code}>
                      {route.code === "ALL" ? "All Routes" : route.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="t-airline" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Airline
                </label>
                <select id="t-airline" className={selectClass} value={airlineCode} onChange={(e) => setAirlineCode(e.target.value)}>
                  {AIRLINES.map((airline) => (
                    <option key={airline.code} value={airline.code}>{airline.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Frequency</span>
                <div className="flex overflow-hidden rounded-sm border border-border">
                  {FREQUENCIES.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFrequency(item.key)}
                      aria-pressed={frequency === item.key}
                      className={`flex-1 px-3 py-2 text-xs font-medium ${
                        frequency === item.key ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main trend */}
        <section className="container-gov py-8" aria-labelledby="main-trend">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="main-trend" className="text-lg font-semibold text-foreground">Average Airfare Trend</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {frequency === "daily" ? "Daily" : frequency === "weekly" ? "Weekly" : "Monthly"} values
                for {routeCode === "ALL" ? "all routes" : routeCode.replace("-", "–")}.
              </p>
            </div>
            <div className="flex overflow-hidden rounded-sm border border-border">
              {MEASURES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMeasure(item.key)}
                  aria-pressed={measure === item.key}
                  className={`px-3 py-1.5 text-xs font-medium ${
                    measure === item.key ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-sm border border-border bg-background p-4">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" minTickGap={28} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    width={64}
                    domain={["auto", "auto"]}
                    tickFormatter={(value: number) => (measure === "index" ? value.toFixed(0) : `₹${Math.round(value)}`)}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Line type="monotone" dataKey={measure} stroke="currentColor" className="text-primary" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Y-axis: {measure === "index" ? "Airfare index (base = 100)" : "Average fare (₹)"} · X-axis: date
            </p>
          </div>
        </section>

        {/* Fare level and index */}
        <section className="container-gov pb-8" aria-labelledby="fare-index">
          <h2 id="fare-index" className="text-lg font-semibold text-foreground">Fare Level and Index</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Average fare represents observed price levels, while APIx represents relative price
            movement from the selected base period ({BASE_PERIOD}).
          </p>
          <div className="mt-4 rounded-sm border border-border bg-background p-4">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" minTickGap={28} />
                  <YAxis yAxisId="fare" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" width={64} tickFormatter={(v: number) => `₹${Math.round(v)}`} />
                  <YAxis yAxisId="idx" orientation="right" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" width={48} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={(value) => formatDate(String(value))}
                    formatter={(value: number, name) =>
                      name === "avgFare" ? [inr(Number(value)), "Actual average fare (Source Data)"] : [Number(value).toFixed(2), "APIx (Calculated)"]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => (value === "avgFare" ? "Actual Average Fare (₹)" : "APIx (base = 100)")} />
                  <Bar yAxisId="fare" dataKey="avgFare" fill="currentColor" className="text-border" isAnimationActive={false} />
                  <Line yAxisId="idx" type="monotone" dataKey="index" stroke="currentColor" className="text-primary" strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Trend highlights */}
        <section className="container-gov pb-8" aria-labelledby="highlights">
          <h2 id="highlights" className="text-lg font-semibold text-foreground">Trend Highlights</h2>
          <dl className="mt-4 grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {highlights.map((item) => (
              <div key={item.term} className="bg-background px-4 py-3">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{item.term}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Airline trends */}
        <section className="container-gov pb-8" aria-labelledby="airline-trends">
          <h2 id="airline-trends" className="text-lg font-semibold text-foreground">Airline-wise Price Trends</h2>
          <p className="mt-1 text-sm text-muted-foreground">Select up to four airlines to compare.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {airlineRows.map((airline) => {
              const active = selectedAirlines.includes(airline.code);
              return (
                <button
                  key={airline.code}
                  type="button"
                  onClick={() => toggleAirline(airline.code)}
                  aria-pressed={active}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-medium ${
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-accent"
                  }`}
                >
                  {airline.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="rounded-sm border border-border bg-background p-4">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={airlineChart} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" minTickGap={28} />
                    <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" width={64} tickFormatter={(v: number) => `₹${Math.round(v)}`} />
                    <Tooltip
                      contentStyle={{ fontSize: 12 }}
                      labelFormatter={(value) => formatDate(String(value))}
                      formatter={(value: number, name) => [inr(Number(value)), AIRLINES.find((a) => a.code === name)?.label ?? String(name)]}
                    />
                    {selectedAirlines.map((code, i) => (
                      <Line
                        key={code}
                        type="monotone"
                        dataKey={code}
                        stroke="currentColor"
                        className={airlineColors[i % airlineColors.length]}
                        strokeWidth={1.8}
                        strokeDasharray={i === 1 ? "5 3" : i === 3 ? "2 3" : undefined}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-x-auto rounded-sm border border-border">
              <table className="w-full min-w-[34rem] border-collapse bg-background">
                <thead className="bg-surface">
                  <tr>
                    <th className={th}>Airline</th>
                    <th className={th}>Average Fare</th>
                    <th className={th}>Route Coverage</th>
                    <th className={th}>Observations</th>
                    <th className={th}>Price Change %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {airlineRows.map((airline) => (
                    <tr
                      key={airline.code}
                      className={`cursor-pointer hover:bg-accent ${selectedAirlines.includes(airline.code) ? "bg-accent/60" : ""}`}
                      onClick={() => toggleAirline(airline.code)}
                    >
                      <td className={`${td} font-medium`}>{airline.label}</td>
                      <td className={`${td} tabular-nums`}>{inr(airline.avgFare)}</td>
                      <td className={`${td} tabular-nums`}>{airline.coverage} routes</td>
                      <td className={`${td} tabular-nums`}>{airline.observations.toLocaleString("en-IN")}</td>
                      <td className={`${td} tabular-nums`}><Delta value={airline.change} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Route trends */}
        <section className="container-gov pb-8" aria-labelledby="route-trends">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="route-trends" className="text-lg font-semibold text-foreground">Route-wise Trends</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="route-sort" className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                Sort by
              </label>
              <select
                id="route-sort"
                value={routeSort}
                onChange={(e) => setRouteSort(e.target.value as RouteSort)}
                className="h-9 rounded-sm border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="increase">Highest increase</option>
                <option value="decrease">Highest decrease</option>
                <option value="fare">Highest fare</option>
                <option value="weight">Largest passenger weight</option>
              </select>
              <a
                href="/route-analytics"
                className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                View Route Intelligence
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-sm border border-border">
            <table className="w-full min-w-[48rem] border-collapse bg-background">
              <thead className="bg-surface">
                <tr>
                  <th className={th}>Route</th>
                  <th className={th}>Average Fare</th>
                  <th className={th}>Base Fare</th>
                  <th className={th}>Current Index</th>
                  <th className={th}>Change %</th>
                  <th className={th}>DGCA Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {routeRows.map((row) => (
                  <tr key={row.code} className="hover:bg-accent">
                    <td className={`${td} font-medium`}>{row.route}</td>
                    <td className={`${td} tabular-nums`}>{inr(row.avgFare)}</td>
                    <td className={`${td} tabular-nums`}>{inr(row.baseFare)}</td>
                    <td className={`${td} tabular-nums`}>{row.index.toFixed(2)}</td>
                    <td className={`${td} tabular-nums`}><Delta value={row.change} /></td>
                    <td className={`${td} tabular-nums`}>{row.weight}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Period comparison */}
        <section className="container-gov pb-8" aria-labelledby="period-comparison">
          <h2 id="period-comparison" className="text-lg font-semibold text-foreground">Period Comparison</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4 rounded-sm border border-border bg-surface p-4">
              {[
                { label: "Period A", value: periodA, set: setPeriodA, stats: statsA },
                { label: "Period B", value: periodB, set: setPeriodB, stats: statsB },
              ].map((block) => (
                <div key={block.label} className="rounded-sm border border-border bg-background p-3">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{block.label}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      aria-label={`${block.label} start date`}
                      value={block.value.from}
                      max={block.value.to}
                      onChange={(e) => block.set({ ...block.value, from: e.target.value })}
                      className={selectClass}
                    />
                    <input
                      type="date"
                      aria-label={`${block.label} end date`}
                      value={block.value.to}
                      max={LATEST_DATE}
                      onChange={(e) => block.set({ ...block.value, to: e.target.value })}
                      className={selectClass}
                    />
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    Average fare <span className="font-semibold tabular-nums">{inr(block.stats.fare)}</span> · index{" "}
                    <span className="font-semibold tabular-nums">{block.stats.index.toFixed(2)}</span> ·{" "}
                    {block.stats.count} observations days
                  </p>
                </div>
              ))}
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border bg-border">
                {[
                  ["Average Fare (B)", inr(statsB.fare)],
                  ["Percentage Change", pct(fareChange)],
                  ["Index Change", `${indexChange > 0 ? "+" : ""}${indexChange.toFixed(2)}`],
                ].map(([term, value]) => (
                  <div key={term} className="bg-background px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{term}</dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-sm border border-border bg-background p-4">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { period: "Period A", fare: Math.round(statsA.fare), index: statsA.index },
                      { period: "Period B", fare: Math.round(statsB.fare), index: statsB.index },
                    ]}
                    margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" width={64} tickFormatter={(v: number) => `₹${Math.round(v)}`} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(value: number) => [inr(Number(value)), "Average fare"]} />
                    <Bar dataKey="fare" fill="currentColor" className="text-primary" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Historical table */}
        <section className="container-gov pb-8" aria-labelledby="historical">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="historical" className="text-lg font-semibold text-foreground">Historical Price Data</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {tableRows.length} periods in the selected range.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="date-search" className="sr-only">Filter by date</label>
              <input
                id="date-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Filter by date (e.g. 2026-08)"
                className="h-9 w-64 rounded-sm border border-border bg-background pl-9 pr-3 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-sm border border-border">
            <table className="w-full min-w-[46rem] border-collapse bg-background">
              <thead className="bg-surface">
                <tr>
                  {([
                    ["date", "Date"],
                    ["avgFare", "Average Fare"],
                    ["medianFare", "Median Fare"],
                    ["index", "APIx"],
                    ["change", "Daily Change"],
                    ["observations", "Observations"],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th key={key} className={th}>
                      <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 hover:text-foreground">
                        {label}
                        {sortKey === key ? (
                          sortAsc ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((row) => (
                  <tr key={row.date} className="hover:bg-accent">
                    <td className={td}>{formatDate(row.date)}</td>
                    <td className={`${td} tabular-nums`}>{inr(row.avgFare)}</td>
                    <td className={`${td} tabular-nums`}>{inr(row.medianFare)}</td>
                    <td className={`${td} tabular-nums`}>{row.index.toFixed(2)}</td>
                    <td className={`${td} tabular-nums`}><Delta value={row.change} /></td>
                    <td className={`${td} tabular-nums`}>{row.observations.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
                {pageRows.length === 0 ? (
                  <tr>
                    <td className={`${td} text-muted-foreground`} colSpan={6}>No records match the current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page === 0}
              className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40 hover:bg-accent"
            >
              Previous
            </button>
            <span className="text-xs tabular-nums text-muted-foreground">Page {page + 1} of {pageCount}</span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
              disabled={page >= pageCount - 1}
              className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40 hover:bg-accent"
            >
              Next
            </button>
          </div>
        </section>

        {/* Coverage + download */}
        <section className="container-gov pb-12" aria-labelledby="coverage">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-sm border border-border bg-surface p-4">
              <h2 id="coverage" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Info className="h-4 w-4" aria-hidden="true" />
                Data Coverage
              </h2>
              <dl className="mt-3 divide-y divide-border rounded-sm border border-border bg-background">
                {[
                  ["Observation Period", `${formatDate(points[0]?.date ?? LATEST_DATE)} – ${formatDate(LATEST_DATE)}`, "Source Data"],
                  ["Routes", `${ROUTES.length - 1}`, "Source Data"],
                  ["Airlines", `${AIRLINES.length - 1}`, "Source Data"],
                  ["Observations", totalObservations.toLocaleString("en-IN"), "Source Data"],
                  ["Latest Update", `${formatDate(LATEST_DATE)}, 06:00 IST`, "Source Data"],
                  ["Index values and changes", "Derived from observed fares", "APIx Calculated"],
                ].map(([term, value, tag]) => (
                  <div key={term} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{term}</dt>
                    <dd className="flex items-center gap-2 text-sm font-medium tabular-nums text-foreground">
                      {value}
                      <Tag>{tag}</Tag>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-sm border border-border bg-background p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Download className="h-4 w-4" aria-hidden="true" />
                Download Trend Data
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Downloads reflect the selected range, route, airline and frequency.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["csv", "xls", "json"] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => exportTrend(format)}
                    className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    {format === "xls" ? "Excel" : format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <FloatingUtilities />
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: TrendPoint }[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]!.payload;
  return (
    <div className="rounded-sm border border-border bg-background px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-foreground">{formatDate(String(label))}</p>
      <p className="mt-1 text-muted-foreground">
        Average fare <span className="font-medium text-foreground">{inr(point.avgFare)}</span>
      </p>
      <p className="text-muted-foreground">
        Median fare <span className="font-medium text-foreground">{inr(point.medianFare)}</span>
      </p>
      <p className="text-muted-foreground">
        APIx <span className="font-medium text-foreground">{point.index.toFixed(2)}</span>
      </p>
      <p className="text-muted-foreground">
        Change <span className="font-medium text-foreground">{pct(point.change, 2)}</span>
      </p>
    </div>
  );
}
