import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FloatingUtilities } from "@/components/site/FloatingUtilities";
import { AIRLINES, LATEST_DATE, ROUTES } from "@/lib/apix-data";
import {
  LEAD_WINDOWS,
  OBSERVATION_PERIOD,
  TRAVEL_DATE_AVAILABLE,
  airlineLeadTime,
  leadCurve,
  routeLeadTime,
  windowLabel,
  windowStats,
  type LeadWindow,
} from "@/lib/leadtime";

const TITLE = "Lead-Time Analysis — Advance-Booking Airfare Windows | APIx, MoSPI";
const DESCRIPTION =
  "Study how observed domestic airfares vary across advance-booking windows T+1, T+7, T+15, T+30 and T+45, by route and airline.";

export const Route = createFileRoute("/lead-time")({
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
  component: LeadTimePage,
});

const selectClass =
  "h-9 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground";
const th = "px-3 py-2 text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground";
const td = "px-3 py-2 text-sm text-foreground";

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function pct(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </span>
  );
}

function Card({ term, value, note }: { term: string; value: string; note?: string }) {
  return (
    <div className="rounded-sm border border-border bg-background p-4">
      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{term}</p>
      <p className="mt-1 font-serif text-xl font-bold tabular-nums text-foreground">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
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

type SortKey = "route" | "spread" | 0 | 1 | 2 | 3 | 4;

function LeadTimePage() {
  const [selected, setSelected] = useState<LeadWindow | "all">("all");
  const [routeCode, setRouteCode] = useState("ALL");
  const [airlineCode, setAirlineCode] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("spread");
  const [sortAsc, setSortAsc] = useState(false);
  const [detailRoute, setDetailRoute] = useState("DEL–BOM");
  const [airlineFilter, setAirlineFilter] = useState<string[]>(["6E", "AI", "SG"]);
  const [compareA, setCompareA] = useState<LeadWindow>(7);
  const [compareB, setCompareB] = useState<LeadWindow>(30);

  const stats = useMemo(() => windowStats(routeCode, airlineCode), [routeCode, airlineCode]);
  const routeRows = useMemo(() => routeLeadTime("ALL", airlineCode), [airlineCode]);
  const curve = useMemo(() => leadCurve(routeCode, airlineCode), [routeCode, airlineCode]);
  const airlineRows = useMemo(() => airlineLeadTime(routeCode), [routeCode]);

  const selectedStat =
    selected === "all" ? null : stats.find((s) => s.window === selected) ?? null;

  const summary = useMemo(() => {
    if (selectedStat) return selectedStat;
    const avgFare = Math.round(stats.reduce((s, r) => s + r.avgFare, 0) / stats.length);
    const medianFare = Math.round(stats.reduce((s, r) => s + r.medianFare, 0) / stats.length);
    return {
      avgFare,
      medianFare,
      routes: stats[0]!.routes,
      observations: stats.reduce((s, r) => s + r.observations, 0),
      changeFromBase: stats.reduce((s, r) => s + r.changeFromBase, 0) / stats.length,
    };
  }, [stats, selectedStat]);

  const sortedRoutes = useMemo(() => {
    const rows = [...routeRows];
    rows.sort((a, b) => {
      if (sortKey === "route") return sortAsc ? a.route.localeCompare(b.route) : b.route.localeCompare(a.route);
      if (sortKey === "spread") return sortAsc ? a.spread - b.spread : b.spread - a.spread;
      const av = a.fares[sortKey]!;
      const bv = b.fares[sortKey]!;
      return sortAsc ? av - bv : bv - av;
    });
    return rows;
  }, [routeRows, sortKey, sortAsc]);

  const detail = routeRows.find((r) => r.route === detailRoute) ?? routeRows[0]!;
  const detailCurve = LEAD_WINDOWS.map((w, i) => ({
    days: w,
    label: windowLabel(w),
    avgFare: detail.fares[i]!,
  }));

  const statA = stats.find((s) => s.window === compareA)!;
  const statB = stats.find((s) => s.window === compareB)!;
  const diff = statA.avgFare - statB.avgFare;
  const diffPct = (diff / statB.avgFare) * 100;

  const observations = useMemo(() => {
    const highest = [...stats].sort((a, b) => b.avgFare - a.avgFare)[0]!;
    const lowest = [...stats].sort((a, b) => a.avgFare - b.avgFare)[0]!;
    const route = [...routeRows].sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread))[0]!;
    const airline = [...airlineRows].sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread))[0]!;
    return [
      { term: "Window with highest average fare", value: `${highest.label} · ${inr(highest.avgFare)}` },
      { term: "Window with lowest average fare", value: `${lowest.label} · ${inr(lowest.avgFare)}` },
      { term: "Route with largest lead-time difference", value: `${route.route} · ${pct(route.spread)}` },
      { term: "Airline with largest lead-time difference", value: `${airline.label} · ${pct(airline.spread)}` },
    ];
  }, [stats, routeRows, airlineRows]);

  const airlineChart = useMemo(
    () =>
      LEAD_WINDOWS.map((w, i) => {
        const row: Record<string, number | string> = { label: windowLabel(w) };
        for (const code of airlineFilter) {
          const airline = airlineRows.find((a) => a.code === code);
          if (airline) row[code] = airline.fares[i]!;
        }
        return row;
      }),
    [airlineRows, airlineFilter],
  );

  const airlineColors = ["var(--color-primary)", "var(--color-saffron)", "var(--color-navy)", "var(--color-muted-foreground)"];

  function resetFilters() {
    setSelected("all");
    setRouteCode("ALL");
    setAirlineCode("ALL");
    setSortKey("spread");
    setSortAsc(false);
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function toggleAirlineFilter(code: string) {
    setAirlineFilter((list) =>
      list.includes(code)
        ? list.length > 1
          ? list.filter((c) => c !== code)
          : list
        : list.length < 4
          ? [...list, code]
          : list,
    );
  }

  function exportData(format: "csv" | "xls" | "json") {
    const rows = sortedRoutes.map((r) => ({
      route: r.route,
      window: selected === "all" ? "All" : windowLabel(selected),
      airline: airlineCode,
      "T+1": r.fares[0]!,
      "T+7": r.fares[1]!,
      "T+15": r.fares[2]!,
      "T+30": r.fares[3]!,
      "T+45": r.fares[4]!,
      changePct: Number(r.spread.toFixed(2)),
    }));
    const name = `apix-lead-time-${LATEST_DATE}`;
    if (format === "json") {
      download(`${name}.json`, JSON.stringify(rows, null, 2), "application/json");
      return;
    }
    const header = Object.keys(rows[0]!);
    const body = [header, ...rows.map((r) => header.map((h) => (r as Record<string, string | number>)[h]!))]
      .map((cells) => cells.join(","))
      .join("\n");
    download(
      `${name}.${format === "csv" ? "csv" : "xls"}`,
      body,
      format === "csv" ? "text/csv" : "application/vnd.ms-excel",
    );
  }

  if (!TRAVEL_DATE_AVAILABLE) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main id="main-content" className="container-gov flex-1 py-16">
          <h1 className="font-serif text-3xl font-bold text-foreground">Lead-Time Analysis</h1>
          <div className="mt-6 rounded-sm border border-border bg-surface p-6">
            <p className="text-sm font-semibold text-foreground">
              Lead-time analysis requires travel-date data.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Travel-date data is currently unavailable for this dataset. Lead-time metrics will
              become available when both collection date and travel date are provided.
            </p>
          </div>
        </main>
        <SiteFooter />
        <FloatingUtilities />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main id="main-content" className="flex-1 pb-28">
        {/* Header */}
        <section className="border-b border-border bg-surface">
          <div className="container-gov py-8">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
                Lead-Time Analysis
              </h1>
              <Tag>APIx Calculated</Tag>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
              Analyse airfare behaviour across advance-booking windows.
            </p>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Lead-time represents the number of days between airfare observation and the scheduled
              travel date.
            </p>
          </div>
        </section>

        {/* Lead-time selector + filters */}
        <section className="container-gov pt-8" aria-labelledby="lead-selector">
          <div className="rounded-sm border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <h2 id="lead-selector" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Lead-Time Window
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
                  onClick={() => setFiltersOpen((v) => !v)}
                  aria-expanded={filtersOpen}
                  className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent md:hidden"
                >
                  {filtersOpen ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-4" role="group" aria-label="Select lead-time window">
              {LEAD_WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={selected === w}
                  onClick={() => setSelected(w)}
                  className={`rounded-sm border px-4 py-2 text-sm font-semibold tabular-nums transition-colors ${
                    selected === w
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent"
                  }`}
                >
                  {windowLabel(w)}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={selected === "all"}
                onClick={() => setSelected("all")}
                className={`rounded-sm border px-4 py-2 text-sm font-semibold transition-colors ${
                  selected === "all"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-accent"
                }`}
              >
                All Windows
              </button>
            </div>

            <div className={`${filtersOpen ? "grid" : "hidden"} gap-4 border-t border-border px-4 py-4 md:grid md:grid-cols-2`}>
              <div>
                <label htmlFor="lt-route" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Route
                </label>
                <select id="lt-route" className={selectClass} value={routeCode} onChange={(e) => setRouteCode(e.target.value)}>
                  {ROUTES.map((route) => (
                    <option key={route.code} value={route.code}>
                      {route.code === "ALL" ? "All Routes" : route.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="lt-airline" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Airline
                </label>
                <select id="lt-airline" className={selectClass} value={airlineCode} onChange={(e) => setAirlineCode(e.target.value)}>
                  {AIRLINES.map((a) => (
                    <option key={a.code} value={a.code}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Summary indicators */}
        <section className="container-gov pt-8" aria-labelledby="lead-summary">
          <h2 id="lead-summary" className="sr-only">Summary indicators</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card term="Selected Lead-Time" value={selected === "all" ? "All Windows" : windowLabel(selected)} />
            <Card term="Average Fare" value={inr(summary.avgFare)} note="Source Data" />
            <Card term="Median Fare" value={inr(summary.medianFare)} note="Source Data" />
            <Card term="Number of Routes" value={String(summary.routes)} />
            <Card term="Number of Observations" value={summary.observations.toLocaleString("en-IN")} />
            <Card term="Change from Base" value={pct(summary.changeFromBase)} note="Relative to T+30" />
          </div>
        </section>

        {/* Main lead-time chart */}
        <section className="container-gov pt-10" aria-labelledby="lead-chart">
          <div className="rounded-sm border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id="lead-chart" className="text-sm font-semibold text-foreground">
                Fare by Advance-Booking Window
              </h2>
              <Tag>Source Data</Tag>
            </div>
            <div className="h-[320px] px-2 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    width={70}
                    tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-accent)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]!.payload as (typeof stats)[number];
                      return (
                        <div className="rounded-sm border border-border bg-background p-3 text-xs shadow-sm">
                          <p className="font-semibold text-foreground">Lead-Time: {row.label}</p>
                          <p className="mt-1 text-muted-foreground">Average Fare: <span className="text-foreground">{inr(row.avgFare)}</span></p>
                          <p className="text-muted-foreground">Median Fare: <span className="text-foreground">{inr(row.medianFare)}</span></p>
                          <p className="text-muted-foreground">Observations: <span className="text-foreground">{row.observations.toLocaleString("en-IN")}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="avgFare" fill="var(--color-primary)" barSize={54} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Lead-time price curve */}
        <section className="container-gov pt-10" aria-labelledby="lead-curve">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-sm border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <h2 id="lead-curve" className="text-sm font-semibold text-foreground">Lead-Time Price Curve</h2>
              </div>
              <div className="h-[300px] px-2 py-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis
                      dataKey="days"
                      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      label={{ value: "Days before travel", position: "insideBottom", offset: -4, fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      width={70}
                      tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0]!.payload as { days: number; avgFare: number };
                        return (
                          <div className="rounded-sm border border-border bg-background p-3 text-xs shadow-sm">
                            <p className="font-semibold text-foreground">{row.days} days before travel</p>
                            <p className="mt-1 text-muted-foreground">Average Fare: <span className="text-foreground">{inr(row.avgFare)}</span></p>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="avgFare" stroke="var(--color-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-sm border border-border bg-surface p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Info className="h-4 w-4" aria-hidden="true" />
                Interpretation
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Lead-time elasticity indicates how airfare changes as the travel date approaches.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Figures describe an observed relationship between the advance-booking window and
                observed fare levels. They do not establish causality.
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3 border-t border-border pt-2">
                  <dt className="text-muted-foreground">T+1 vs T+45</dt>
                  <dd className="tabular-nums text-foreground">
                    {pct(((stats[0]!.avgFare - stats[4]!.avgFare) / stats[4]!.avgFare) * 100)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-border pt-2">
                  <dt className="text-muted-foreground">T+7 vs T+30</dt>
                  <dd className="tabular-nums text-foreground">
                    {pct(((stats[1]!.avgFare - stats[3]!.avgFare) / stats[3]!.avgFare) * 100)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Route-wise lead-time */}
        <section className="container-gov pt-10" aria-labelledby="lead-routes">
          <div className="rounded-sm border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id="lead-routes" className="text-sm font-semibold text-foreground">Lead-Time by Route</h2>
              <Link
                to="/route-analytics"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                View Route Intelligence
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead className="border-b border-border bg-background">
                  <tr>
                    <th className={th}>
                      <button type="button" onClick={() => toggleSort("route")} className="uppercase tracking-[0.1em]">Route</button>
                    </th>
                    {LEAD_WINDOWS.map((w, i) => (
                      <th key={w} className={`${th} text-right`}>
                        <button type="button" onClick={() => toggleSort(i as SortKey)} className="uppercase tracking-[0.1em]">
                          {windowLabel(w)}
                        </button>
                      </th>
                    ))}
                    <th className={`${th} text-right`}>
                      <button type="button" onClick={() => toggleSort("spread")} className="uppercase tracking-[0.1em]">Change</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRoutes.map((row) => (
                    <tr
                      key={row.route}
                      className={`border-b border-border last:border-0 ${row.route === detailRoute ? "bg-accent" : ""}`}
                    >
                      <td className={td}>
                        <button
                          type="button"
                          onClick={() => setDetailRoute(row.route)}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.route}
                        </button>
                      </td>
                      {row.fares.map((fare, i) => (
                        <td key={i} className={`${td} text-right tabular-nums`}>{inr(fare)}</td>
                      ))}
                      <td className={`${td} text-right tabular-nums`}>{pct(row.spread)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Airline lead-time */}
        <section className="container-gov pt-10" aria-labelledby="lead-airlines">
          <div className="rounded-sm border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 id="lead-airlines" className="text-sm font-semibold text-foreground">Lead-Time by Airline</h2>
              <div className="flex flex-wrap gap-2">
                {airlineRows.map((a) => (
                  <button
                    key={a.code}
                    type="button"
                    aria-pressed={airlineFilter.includes(a.code)}
                    onClick={() => toggleAirlineFilter(a.code)}
                    className={`rounded-sm border px-2.5 py-1 text-xs font-medium ${
                      airlineFilter.includes(a.code)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[300px] px-2 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={airlineChart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    width={70}
                    tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-background)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 2,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [inr(value), name]}
                  />
                  {airlineFilter.map((code, i) => (
                    <Line
                      key={code}
                      type="monotone"
                      dataKey={code}
                      name={airlineRows.find((a) => a.code === code)?.label ?? code}
                      stroke={airlineColors[i % airlineColors.length]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[720px] border-collapse">
                <thead className="border-b border-border bg-background">
                  <tr>
                    <th className={th}>Airline</th>
                    {LEAD_WINDOWS.map((w) => (
                      <th key={w} className={`${th} text-right`}>{windowLabel(w)} Average Fare</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {airlineRows
                    .filter((a) => airlineFilter.includes(a.code))
                    .map((a) => (
                      <tr key={a.code} className="border-b border-border last:border-0">
                        <td className={td}>{a.label}</td>
                        {a.fares.map((fare, i) => (
                          <td key={i} className={`${td} text-right tabular-nums`}>{inr(fare)}</td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Window comparison + route detail */}
        <section className="container-gov pt-10">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-sm border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Booking Window Comparison</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 px-4 py-4">
                <div>
                  <label htmlFor="cmp-a" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Window A</label>
                  <select id="cmp-a" className={selectClass} value={compareA} onChange={(e) => setCompareA(Number(e.target.value) as LeadWindow)}>
                    {LEAD_WINDOWS.map((w) => <option key={w} value={w}>{windowLabel(w)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="cmp-b" className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Window B</label>
                  <select id="cmp-b" className={selectClass} value={compareB} onChange={(e) => setCompareB(Number(e.target.value) as LeadWindow)}>
                    {LEAD_WINDOWS.map((w) => <option key={w} value={w}>{windowLabel(w)}</option>)}
                  </select>
                </div>
              </div>
              <div className="h-[200px] px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[statA, statB]} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickLine={false} width={70} tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                    <Tooltip cursor={{ fill: "var(--color-accent)" }} formatter={(value: number) => inr(value)} contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: 2, fontSize: 12 }} />
                    <Bar dataKey="avgFare" name="Average Fare" fill="var(--color-primary)" barSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto border-t border-border">
                <table className="w-full border-collapse">
                  <thead className="border-b border-border bg-background">
                    <tr>
                      <th className={th}>Measure</th>
                      <th className={`${th} text-right`}>{statA.label}</th>
                      <th className={`${th} text-right`}>{statB.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border">
                      <td className={td}>Average Fare</td>
                      <td className={`${td} text-right tabular-nums`}>{inr(statA.avgFare)}</td>
                      <td className={`${td} text-right tabular-nums`}>{inr(statB.avgFare)}</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className={td}>Median Fare</td>
                      <td className={`${td} text-right tabular-nums`}>{inr(statA.medianFare)}</td>
                      <td className={`${td} text-right tabular-nums`}>{inr(statB.medianFare)}</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className={td}>Observations</td>
                      <td className={`${td} text-right tabular-nums`}>{statA.observations.toLocaleString("en-IN")}</td>
                      <td className={`${td} text-right tabular-nums`}>{statB.observations.toLocaleString("en-IN")}</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className={td}>Difference</td>
                      <td className={`${td} text-right tabular-nums`} colSpan={2}>{inr(Math.abs(diff))}</td>
                    </tr>
                    <tr>
                      <td className={td}>Percentage Difference</td>
                      <td className={`${td} text-right tabular-nums`} colSpan={2}>{pct(diffPct)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-sm border border-border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Route Detail — {detail.route}</h2>
                <Tag>Source Data</Tag>
              </div>
              <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-5">
                {LEAD_WINDOWS.map((w, i) => (
                  <div key={w} className="rounded-sm border border-border bg-background p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{windowLabel(w)}</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{inr(detail.fares[i]!)}</p>
                  </div>
                ))}
              </div>
              <div className="h-[240px] px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={detailCurve} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} tickLine={false} width={70} tickFormatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                    <Tooltip formatter={(value: number) => inr(value)} contentStyle={{ background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: 2, fontSize: 12 }} />
                    <Line type="monotone" dataKey="avgFare" name="Average Fare" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* Key observations + data availability */}
        <section className="container-gov pt-10">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-sm border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Key Observations</h2>
              </div>
              <dl className="divide-y divide-border">
                {observations.map((item) => (
                  <div key={item.term} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                    <dt className="text-sm text-muted-foreground">{item.term}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-foreground">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-sm border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Data Availability</h2>
              </div>
              <div className="px-4 py-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  Lead-time analysis available
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The loaded dataset contains both collection date and travel date, so lead-time
                  windows can be derived directly from observations.
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <dt className="text-muted-foreground">Observation period</dt>
                    <dd className="text-foreground">{OBSERVATION_PERIOD}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <dt className="text-muted-foreground">Routes covered</dt>
                    <dd className="tabular-nums text-foreground">{routeRows.length}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <dt className="text-muted-foreground">Airlines covered</dt>
                    <dd className="tabular-nums text-foreground">{airlineRows.length}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <dt className="text-muted-foreground">Latest observation</dt>
                    <dd className="text-foreground">{LATEST_DATE}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* Methodology + download */}
        <section className="container-gov pt-10">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-sm border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  How lead-time is calculated
                </h2>
              </div>
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-4">
                {[
                  { step: "01", term: "Collection Date", note: "Date the airfare was observed" },
                  { step: "02", term: "Travel Date", note: "Scheduled date of travel" },
                  { step: "03", term: "Travel Date − Collection Date", note: "Lead-time in days" },
                  { step: "04", term: "Lead-Time Window", note: "Mapped to T+1 … T+45 for fare analysis" },
                ].map((item) => (
                  <div key={item.step} className="rounded-sm border border-border bg-background p-3">
                    <p className="font-serif text-lg font-bold text-primary">{item.step}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{item.term}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border px-4 py-4 text-sm text-muted-foreground">
                <p>
                  Example — Collection Date: 1 August · Travel Date: 8 August · Lead-Time: 7 days ·
                  Therefore: <span className="font-semibold text-foreground">T+7</span>
                </p>
                <Link to="/airfare-index" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  View Methodology
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="rounded-sm border border-border bg-surface">
              <div className="border-b border-border px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download Lead-Time Data
                </h2>
              </div>
              <div className="px-4 py-4">
                <p className="text-xs text-muted-foreground">Downloads respect the active filters.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["csv", "xls", "json"] as const).map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => exportData(format)}
                      className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      {format === "xls" ? "Excel" : format.toUpperCase()}
                    </button>
                  ))}
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
