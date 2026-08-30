import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  LATEST_DATE,
  RANGE_OPTIONS,
  aggregate,
  buildSeries,
  formatDate,
  type RangeKey,
} from "@/lib/apix-data";
import {
  CITIES,
  INDIA_OUTLINE,
  MAP_HEIGHT,
  MAP_WIDTH,
  TOTAL_TRAFFIC,
  cityOf,
  formatTraffic,
  project,
  routeIntel,
  type RouteIntel,
} from "@/lib/route-intel";

const TITLE = "Route Intelligence — Domestic Air Route Statistics | APIx, MoSPI";
const DESCRIPTION =
  "Explore India's domestic air routes: DGCA passenger traffic, route weights, average fares, route-level APIx values and fare movements.";

export const Route = createFileRoute("/route-analytics")({
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
  component: RouteIntelligencePage,
});

const selectClass =
  "h-9 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground";
const PAGE_SIZE = 10;

type MetricKey = "traffic" | "weight" | "change";
const METRICS: { key: MetricKey; label: string }[] = [
  { key: "traffic", label: "Passenger Traffic" },
  { key: "weight", label: "Route Weight" },
  { key: "change", label: "Airfare Change" },
];

type SortKey = "traffic" | "share" | "weight" | "avgFare" | "index" | "change" | "route";

function pct(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function inr(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
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

function RouteIntelligencePage() {
  const [origin, setOrigin] = useState("ALL");
  const [destination, setDestination] = useState("ALL");
  const [routeCode, setRouteCode] = useState("ALL");
  const [range, setRange] = useState<RangeKey>("30d");
  const [airlineCode, setAirlineCode] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [metric, setMetric] = useState<MetricKey>("traffic");
  const [selected, setSelected] = useState("DEL-BOM");
  const [compare, setCompare] = useState<string[]>(["DEL-BOM", "DEL-BLR", "BOM-BLR"]);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("traffic");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const all = useMemo(() => routeIntel(airlineCode), [airlineCode]);

  const filtered = useMemo(
    () =>
      all.filter((row) => {
        if (routeCode !== "ALL" && row.code !== routeCode) return false;
        if (origin !== "ALL" && row.origin !== origin) return false;
        if (destination !== "ALL" && row.destination !== destination) return false;
        return true;
      }),
    [all, routeCode, origin, destination],
  );

  const days = RANGE_OPTIONS.find((option) => option.key === range)!.days;
  const selectedRow = filtered.find((r) => r.code === selected) ?? filtered[0] ?? all[0]!;

  const series = useMemo(() => {
    const daily = buildSeries(selectedRow.code, airlineCode, Math.max(days, 30));
    const windowed = daily.slice(-days);
    return aggregate(windowed, days > 120 ? "weekly" : "daily").map((point) => ({
      ...point,
      fare: Math.round((selectedRow.baseFare * point.index) / 100),
    }));
  }, [selectedRow, airlineCode, days]);

  const sorted = useMemo(() => {
    const rows = filtered.filter((row) =>
      row.route.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return [...rows].sort((a, b) => {
      if (sortKey === "route") return sortAsc ? a.route.localeCompare(b.route) : b.route.localeCompare(a.route);
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortAsc ? av - bv : bv - av;
    });
  }, [filtered, query, sortKey, sortAsc]);

  const pageCount = showAll ? 1 : Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = showAll ? sorted : sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const byChange = useMemo(() => [...filtered].sort((a, b) => b.change - a.change), [filtered]);
  const increases = byChange.slice(0, 5);
  const decreases = [...byChange].reverse().slice(0, 5);
  const heaviest = [...filtered].sort((a, b) => b.weight - a.weight)[0];
  const trafficTotal = filtered.reduce((sum, row) => sum + row.traffic, 0);

  const metricValue = (row: RouteIntel) =>
    metric === "traffic" ? row.traffic : metric === "weight" ? row.weight : row.change;
  const metricMax = Math.max(...all.map((row) => Math.abs(metricValue(row))), 1);

  const compareRows = all.filter((row) => compare.includes(row.code));

  function resetFilters() {
    setOrigin("ALL");
    setDestination("ALL");
    setRouteCode("ALL");
    setRange("30d");
    setAirlineCode("ALL");
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

  function toggleCompare(code: string) {
    setCompare((list) =>
      list.includes(code)
        ? list.length > 2
          ? list.filter((item) => item !== code)
          : list
        : list.length < 5
          ? [...list, code]
          : list,
    );
  }

  function exportRows(format: "csv" | "xls") {
    const header = [
      "Route",
      "Passenger Traffic",
      "Passenger Share %",
      "DGCA Weight %",
      "Average Fare (INR)",
      "Route Index",
      "Change %",
      "Observations",
    ];
    const lines = [header, ...sorted.map((row) => [
      row.route,
      row.traffic,
      row.share,
      row.weight,
      row.avgFare,
      row.index,
      row.change,
      row.observations,
    ])]
      .map((cells) => cells.join(","))
      .join("\n");
    download(
      `apix-route-data-${LATEST_DATE}.${format === "csv" ? "csv" : "xls"}`,
      lines,
      format === "csv" ? "text/csv" : "application/vnd.ms-excel",
    );
  }

  const th = "px-3 py-2 text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground";
  const td = "px-3 py-2 text-sm text-foreground";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main id="main-content" className="flex-1 pb-28">
        {/* Page header */}
        <section className="border-b border-border bg-surface">
          <div className="container-gov py-8">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
                Route Intelligence
              </h1>
              <Tag>DGCA + APIx</Tag>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
              Explore domestic routes, passenger traffic, route weights and airfare movements.
            </p>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Route importance in APIx is represented using passenger traffic, while airfare
              movements are calculated from observed fare data.
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="container-gov pt-8" aria-labelledby="route-filters">
          <div className="rounded-sm border border-border bg-surface">
            <div className="flex items-center justify-between px-4 py-3">
              <h2
                id="route-filters"
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
              className={`${filtersOpen ? "grid" : "hidden"} gap-4 border-t border-border px-4 py-4 md:grid md:grid-cols-2 lg:grid-cols-5`}
            >
              <div>
                <label htmlFor="f-origin" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Origin
                </label>
                <select id="f-origin" className={selectClass} value={origin} onChange={(e) => setOrigin(e.target.value)}>
                  <option value="ALL">All Origins</option>
                  {CITIES.map((city) => (
                    <option key={city.code} value={city.code}>{`${city.code} — ${city.name}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-dest" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Destination
                </label>
                <select id="f-dest" className={selectClass} value={destination} onChange={(e) => setDestination(e.target.value)}>
                  <option value="ALL">All Destinations</option>
                  {CITIES.map((city) => (
                    <option key={city.code} value={city.code}>{`${city.code} — ${city.name}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-route" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Route
                </label>
                <select id="f-route" className={selectClass} value={routeCode} onChange={(e) => setRouteCode(e.target.value)}>
                  <option value="ALL">All Routes</option>
                  {all.map((row) => (
                    <option key={row.code} value={row.code}>{row.route}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-period" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Time Period
                </label>
                <select id="f-period" className={selectClass} value={range} onChange={(e) => setRange(e.target.value as RangeKey)}>
                  {RANGE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-airline" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Airline
                </label>
                <select id="f-airline" className={selectClass} value={airlineCode} onChange={(e) => setAirlineCode(e.target.value)}>
                  {AIRLINES.map((airline) => (
                    <option key={airline.code} value={airline.code}>{airline.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Route summary */}
        <section className="container-gov py-8" aria-labelledby="route-summary">
          <h2 id="route-summary" className="sr-only">Route summary</h2>
          <dl className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {[
              { term: "Routes in APIx Basket", value: filtered.length.toString() },
              { term: "Total Passenger Traffic", value: formatTraffic(trafficTotal) },
              { term: "Highest-Weight Route", value: heaviest ? `${heaviest.route} · ${heaviest.weight}%` : "—" },
              { term: "Highest Airfare Increase", value: increases[0] ? `${increases[0].route} · ${pct(increases[0].change)}` : "—" },
              { term: "Highest Airfare Decrease", value: decreases[0] ? `${decreases[0].route} · ${pct(decreases[0].change)}` : "—" },
            ].map((item) => (
              <div key={item.term} className="bg-background px-4 py-3">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{item.term}</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Map + detail */}
        <section className="container-gov" aria-labelledby="map-heading">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-sm border border-border bg-background">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 id="map-heading" className="text-sm font-semibold text-foreground">
                  Domestic Air Routes
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">View by</span>
                  <div className="flex overflow-hidden rounded-sm border border-border">
                    {METRICS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setMetric(item.key)}
                        aria-pressed={metric === item.key}
                        className={`px-3 py-1.5 text-xs font-medium ${
                          metric === item.key
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-foreground hover:bg-accent"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4">
                <svg
                  viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                  className="h-[26rem] w-full md:h-[34rem]"
                  role="img"
                  aria-label="Map of India showing major domestic air routes in the APIx basket"
                >
                  <polygon
                    points={INDIA_OUTLINE.map(([lon, lat]) => {
                      const p = project(lon, lat);
                      return `${p.x},${p.y}`;
                    }).join(" ")}
                    className="fill-surface stroke-border"
                    strokeWidth={1.5}
                  />
                  {all.map((row) => {
                    const a = cityOf(row.origin);
                    const b = cityOf(row.destination);
                    if (!a || !b) return null;
                    const p1 = project(a.lon, a.lat);
                    const p2 = project(b.lon, b.lat);
                    const dim = filtered.some((r) => r.code === row.code);
                    const width = 0.8 + (Math.abs(metricValue(row)) / metricMax) * 4.2;
                    const isSelected = row.code === selectedRow.code;
                    return (
                      <g key={row.code}>
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          strokeWidth={width}
                          strokeLinecap="round"
                          className={
                            isSelected
                              ? "stroke-saffron"
                              : dim
                                ? "stroke-primary/60"
                                : "stroke-border"
                          }
                        />
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          strokeWidth={16}
                          stroke="transparent"
                          className="cursor-pointer"
                          onClick={() => setSelected(row.code)}
                        >
                          <title>{`${row.route} — ${formatTraffic(row.traffic)} passengers`}</title>
                        </line>
                      </g>
                    );
                  })}
                  {CITIES.map((city) => {
                    const p = project(city.lon, city.lat);
                    return (
                      <g key={city.code}>
                        <circle cx={p.x} cy={p.y} r={5} className="fill-primary" />
                        <text
                          x={p.x + 9}
                          y={p.y + 4}
                          className="fill-foreground text-[13px]"
                        >
                          {city.code}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <p className="mt-2 text-xs text-muted-foreground">
                  Line thickness represents {METRICS.find((m) => m.key === metric)!.label.toLowerCase()}.
                  Select a route line to view its statistics.
                </p>
              </div>
            </div>

            {/* Selected route detail */}
            <div className="rounded-sm border border-border bg-background">
              <div className="border-b border-border px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Selected route</p>
                <p className="font-serif text-2xl font-bold text-foreground">{selectedRow.route}</p>
              </div>
              <dl className="divide-y divide-border">
                {[
                  ["Passenger Traffic", formatTraffic(selectedRow.traffic), "DGCA"],
                  ["DGCA Weight", `${selectedRow.weight}%`, "DGCA"],
                  ["Current Average Fare", inr(selectedRow.avgFare), "Source Data"],
                  ["Base Fare", inr(selectedRow.baseFare), "Source Data"],
                  ["Route Index", selectedRow.index.toFixed(2), "APIx Calculated"],
                  ["Change from Base", pct(selectedRow.change), "APIx Calculated"],
                  ["Observations", selectedRow.observations.toLocaleString("en-IN"), "Source Data"],
                ].map(([term, value, tag]) => (
                  <div key={term} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <dt className="text-xs text-muted-foreground">
                      {term}
                      <span className="ml-2 text-[10px] uppercase tracking-[0.08em] opacity-70">{tag}</span>
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Selected route chart */}
        <section className="container-gov py-8" aria-labelledby="movement-chart">
          <h2 id="movement-chart" className="text-lg font-semibold text-foreground">
            Airfare Movement — {selectedRow.route}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Route index and indicative fare over the selected period ({RANGE_OPTIONS.find((o) => o.key === range)!.label}).
          </p>
          <div className="mt-4 rounded-sm border border-border bg-background p-4">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    domain={["auto", "auto"]}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={(value) => formatDate(String(value))}
                    formatter={(value: number, name) =>
                      name === "fare" ? [inr(Number(value)), "Average fare"] : [Number(value).toFixed(2), "Route index"]
                    }
                  />
                  <Line type="monotone" dataKey="index" stroke="currentColor" className="text-primary" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Contribution */}
        <section className="container-gov pb-8" aria-labelledby="contribution">
          <div className="rounded-sm border border-border bg-surface p-4">
            <h2 id="contribution" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="h-4 w-4" aria-hidden="true" />
              Contribution to APIx
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              A route&apos;s contribution to the national index is its route index multiplied by its
              DGCA route weight.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {[
                ["DGCA Weight", `${selectedRow.weight}%`],
                ["Route Index", selectedRow.index.toFixed(2)],
                ["Weighted Contribution", selectedRow.contribution.toFixed(2)],
              ].map(([term, value]) => (
                <div key={term} className="rounded-sm border border-border bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{term}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="h-3 w-full overflow-hidden rounded-sm border border-border bg-background">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, (selectedRow.weight / 20) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Share of basket weight held by {selectedRow.route} (scale: 0–20%).
              </p>
            </div>
          </div>
        </section>

        {/* Major routes table */}
        <section className="container-gov pb-8" aria-labelledby="major-routes">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="major-routes" className="text-lg font-semibold text-foreground">
                Major Routes by Passenger Traffic
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Passenger traffic and weights: DGCA. Route index and change: APIx calculated.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="route-search" className="sr-only">Search routes</label>
              <input
                id="route-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
                placeholder="Search route"
                className="h-9 w-56 rounded-sm border border-border bg-background pl-9 pr-3 text-sm text-foreground"
              />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-sm border border-border">
            <table className="w-full min-w-[62rem] border-collapse bg-background">
              <thead className="bg-surface">
                <tr>
                  <th className={th}>Rank</th>
                  {([
                    ["route", "Route"],
                    ["traffic", "Passenger Traffic"],
                    ["share", "Passenger Share"],
                    ["weight", "DGCA Weight"],
                    ["avgFare", "Current Average Fare"],
                    ["index", "Route Index"],
                    ["change", "Change %"],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th key={key} className={th}>
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {label}
                        {sortKey === key ? (
                          sortAsc ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />
                        ) : null}
                      </button>
                    </th>
                  ))}
                  <th className={th}>Compare</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {current.map((row, i) => (
                  <tr
                    key={row.code}
                    className={`cursor-pointer hover:bg-accent ${row.code === selectedRow.code ? "bg-accent/60" : ""}`}
                    onClick={() => setSelected(row.code)}
                  >
                    <td className={`${td} tabular-nums text-muted-foreground`}>
                      {(showAll ? 0 : page * PAGE_SIZE) + i + 1}
                    </td>
                    <td className={`${td} font-medium`}>{row.route}</td>
                    <td className={`${td} tabular-nums`}>{formatTraffic(row.traffic)}</td>
                    <td className={`${td} tabular-nums`}>{row.share.toFixed(1)}%</td>
                    <td className={`${td} tabular-nums`}>{row.weight}%</td>
                    <td className={`${td} tabular-nums`}>{inr(row.avgFare)}</td>
                    <td className={`${td} tabular-nums`}>{row.index.toFixed(2)}</td>
                    <td className={`${td} tabular-nums`}><Delta value={row.change} /></td>
                    <td className={td}>
                      <input
                        type="checkbox"
                        aria-label={`Compare ${row.route}`}
                        checked={compare.includes(row.code)}
                        onChange={() => toggleCompare(row.code)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                    </td>
                  </tr>
                ))}
                {current.length === 0 ? (
                  <tr>
                    <td className={`${td} text-muted-foreground`} colSpan={9}>
                      No routes match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {current.length} of {sorted.length} routes
            </p>
            <div className="flex items-center gap-2">
              {!showAll ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                    disabled={page === 0}
                    className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40 hover:bg-accent"
                  >
                    Previous
                  </button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Page {page + 1} of {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                    disabled={page >= pageCount - 1}
                    className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-40 hover:bg-accent"
                  >
                    Next
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setShowAll((value) => !value);
                  setPage(0);
                }}
                className="inline-flex items-center gap-1 rounded-sm border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-navy"
              >
                {showAll ? "Show Top 10" : "View All Routes"}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* Airfare movement rankings */}
        <section className="container-gov pb-8" aria-labelledby="airfare-movement">
          <h2 id="airfare-movement" className="text-lg font-semibold text-foreground">
            Route-level Airfare Movement
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {[
              { title: "Highest Increase", rows: increases },
              { title: "Highest Decrease", rows: decreases },
            ].map((block) => (
              <div key={block.title} className="overflow-hidden rounded-sm border border-border">
                <p className="border-b border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground">
                  {block.title}
                </p>
                <table className="w-full border-collapse bg-background">
                  <thead>
                    <tr>
                      <th className={th}>Route</th>
                      <th className={th}>Current Fare</th>
                      <th className={th}>Route Index</th>
                      <th className={th}>Change %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {block.rows.map((row) => (
                      <tr key={row.code} className="cursor-pointer hover:bg-accent" onClick={() => setSelected(row.code)}>
                        <td className={`${td} font-medium`}>{row.route}</td>
                        <td className={`${td} tabular-nums`}>{inr(row.avgFare)}</td>
                        <td className={`${td} tabular-nums`}>{row.index.toFixed(2)}</td>
                        <td className={`${td} tabular-nums`}><Delta value={row.change} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>

        {/* Compare routes */}
        <section className="container-gov pb-8" aria-labelledby="compare-routes">
          <h2 id="compare-routes" className="text-lg font-semibold text-foreground">Compare Routes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select between 2 and 5 routes. Selection is shared with the routes table.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {all.map((row) => {
              const active = compare.includes(row.code);
              return (
                <button
                  key={row.code}
                  type="button"
                  onClick={() => toggleCompare(row.code)}
                  aria-pressed={active}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent"
                  }`}
                >
                  {row.route}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="rounded-sm border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">Route index</p>
              <div className="mt-3 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareRows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="route" tick={{ fontSize: 10 }} stroke="currentColor" className="text-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" width={44} domain={[90, "auto"]} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(value: number) => [Number(value).toFixed(2), "Route index"]} />
                    <Bar dataKey="index" fill="currentColor" className="text-primary" isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-x-auto rounded-sm border border-border">
              <table className="w-full min-w-[34rem] border-collapse bg-background">
                <thead className="bg-surface">
                  <tr>
                    <th className={th}>Route</th>
                    <th className={th}>Average Fare</th>
                    <th className={th}>Route Index</th>
                    <th className={th}>Fare Change</th>
                    <th className={th}>Passenger Traffic</th>
                    <th className={th}>DGCA Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {compareRows.map((row) => (
                    <tr key={row.code}>
                      <td className={`${td} font-medium`}>{row.route}</td>
                      <td className={`${td} tabular-nums`}>{inr(row.avgFare)}</td>
                      <td className={`${td} tabular-nums`}>{row.index.toFixed(2)}</td>
                      <td className={`${td} tabular-nums`}><Delta value={row.change} /></td>
                      <td className={`${td} tabular-nums`}>{formatTraffic(row.traffic)}</td>
                      <td className={`${td} tabular-nums`}>{row.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Weights + data source + downloads */}
        <section className="container-gov pb-12" aria-labelledby="weights-heading">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-sm border border-border bg-surface p-4">
              <h2 id="weights-heading" className="text-sm font-semibold text-foreground">
                How route weights are calculated
              </h2>
              <ol className="mt-3 space-y-2 text-sm text-foreground">
                <li className="rounded-sm border border-border bg-background px-3 py-2">
                  Passenger Traffic of Route
                </li>
                <li className="pl-3 text-muted-foreground" aria-hidden="true">↓</li>
                <li className="rounded-sm border border-border bg-background px-3 py-2">
                  Total Passenger Traffic
                </li>
                <li className="pl-3 text-muted-foreground" aria-hidden="true">↓</li>
                <li className="rounded-sm border border-border bg-background px-3 py-2">
                  DGCA Route Weight
                </li>
              </ol>
              <p className="mt-3 rounded-sm border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
                Route Weight = Route Passenger Traffic / Total Passenger Traffic
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Higher passenger traffic gives a route greater representation in the APIx basket.
                Total domestic traffic reference: {formatTraffic(TOTAL_TRAFFIC)} passengers.
              </p>
              <a
                href="/data-sources"
                className="mt-4 inline-flex items-center gap-1 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                View DGCA Data
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>

            <div className="space-y-6">
              <div className="rounded-sm border border-border bg-background p-4">
                <h2 className="text-sm font-semibold text-foreground">Data source</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Passenger traffic, route weights</dt>
                    <dd><Tag>DGCA</Tag></dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Observed airfare data</dt>
                    <dd><Tag>Source Data</Tag></dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Route index, fare movement, weighted contribution</dt>
                    <dd><Tag>APIx Calculated</Tag></dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  APIx calculated indicators are derived statistics and are not official DGCA
                  statistics. Latest observation: {formatDate(LATEST_DATE)}.
                </p>
              </div>

              <div className="rounded-sm border border-border bg-background p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download Route Data
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Downloads reflect the currently selected filters ({sorted.length} routes).
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => exportRows("csv")}
                    className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => exportRows("xls")}
                    className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    Excel
                  </button>
                </div>
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
