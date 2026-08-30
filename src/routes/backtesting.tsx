import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  ArrowRight,
  CalendarDays,
  Download,
  Info,
  Play,
  SlidersHorizontal,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FloatingUtilities } from "@/components/site/FloatingUtilities";
import { AIRLINES, formatDate } from "@/lib/apix-data";
import {
  AVAILABLE_PERIODS,
  BACKTEST_DURATION_DAYS,
  BASE_INDEX,
  CPI_OVERLAP_AVAILABLE,
  runBacktest,
  type ContributionRow,
} from "@/lib/backtest";

const TITLE = "APIx Backtesting — Historical Validation of the Airfare Index | MoSPI";
const DESCRIPTION =
  "Apply the APIx methodology to historical domestic airfare observations over a 30-day period and examine index behaviour, route contribution and data coverage.";

export const Route = createFileRoute("/backtesting")({
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
  component: BacktestingPage,
});

const selectClass =
  "h-9 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground";
const th = "px-3 py-2 text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground";
const td = "px-3 py-2 text-sm text-foreground";

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function pct(value: number, digits = 2) {
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

type ContribSort = "weight" | "fareChange" | "contribution";

const PAGE_SIZE = 10;

function BacktestingPage() {
  const defaultPeriod = AVAILABLE_PERIODS[0]!;
  const [periodStart, setPeriodStart] = useState(defaultPeriod.start);
  const [airlineCode, setAirlineCode] = useState("ALL");
  const [configOpen, setConfigOpen] = useState(false);
  const [run, setRun] = useState({ start: defaultPeriod.start, airline: "ALL" });
  const [contribSort, setContribSort] = useState<ContribSort>("contribution");
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [sortKey, setSortKey] = useState<"date" | "index" | "dailyChange">("date");
  const [page, setPage] = useState(0);

  const period =
    AVAILABLE_PERIODS.find((p) => p.start === run.start) ?? defaultPeriod;

  const result = useMemo(
    () => runBacktest(period.start, period.end, run.airline),
    [period.start, period.end, run.airline],
  );

  const dirty = periodStart !== run.start || airlineCode !== run.airline;

  const contributions = useMemo(() => {
    const rows: ContributionRow[] = [...result.contributions];
    rows.sort((a, b) => b[contribSort] - a[contribSort]);
    return rows;
  }, [result.contributions, contribSort]);

  const tableRows = useMemo(() => {
    const rows = result.days.filter((d) => d.date.includes(query.trim()));
    rows.sort((a, b) => {
      const diff =
        sortKey === "date"
          ? a.date.localeCompare(b.date)
          : (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? diff : -diff;
    });
    return rows;
  }, [result.days, query, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = tableRows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: "date" | "index" | "dailyChange") {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(0);
  }

  function reset() {
    setPeriodStart(defaultPeriod.start);
    setAirlineCode("ALL");
    setRun({ start: defaultPeriod.start, airline: "ALL" });
    setQuery("");
    setPage(0);
  }

  function exportData(format: "csv" | "xls" | "json") {
    const rows = result.days.map((d) => ({
      date: d.date,
      apix: d.index,
      dailyChangePct: d.dailyChange,
      sevenDayChangePct: d.weekChange,
      routesCovered: d.routesCovered,
      observations: d.observations,
    }));
    const name = `apix-backtest-${period.start}-to-${period.end}`;
    if (format === "json") {
      download(
        `${name}.json`,
        JSON.stringify(
          { period, airline: run.airline, baseIndex: BASE_INDEX, status: result.status, results: rows },
          null,
          2,
        ),
        "application/json",
      );
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

  function downloadReport() {
    const lines = [
      "APIx Backtest Report",
      "====================",
      `Period: ${period.label}`,
      `Airline: ${AIRLINES.find((a) => a.code === run.airline)?.label ?? "All Airlines"}`,
      `Base period: first observation day (${formatDate(period.start)}), base index ${BASE_INDEX}`,
      `Status: ${result.status}`,
      "",
      `Observation days: ${result.availableDays} of ${result.expectedDays} (missing ${result.missingDays})`,
      `Airfare observations: ${result.observations.toLocaleString("en-IN")}`,
      `Routes included: ${result.routes}    Airlines included: ${result.airlines}`,
      "",
      `Highest APIx: ${result.highest.index} on ${result.highest.date}`,
      `Lowest APIx: ${result.lowest.index} on ${result.lowest.date}`,
      `Largest daily increase: ${pct(result.largestIncrease.dailyChange)} on ${result.largestIncrease.date}`,
      `Largest daily decrease: ${pct(result.largestDecrease.dailyChange)} on ${result.largestDecrease.date}`,
      `Average APIx: ${result.average}`,
      "",
      "Validation status: historical methodology backtest available.",
      CPI_OVERLAP_AVAILABLE
        ? ""
        : "Official CPI comparison is not available for this historical period.",
    ];
    download(`apix-backtest-report-${period.start}.txt`, lines.join("\n"), "text/plain");
  }

  const statusTone =
    result.status === "Completed"
      ? "border-primary text-primary"
      : result.status === "Partial Coverage"
        ? "border-saffron text-foreground"
        : "border-destructive text-destructive";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main id="main-content" className="flex-1 pb-28">
        {/* Header */}
        <section className="border-b border-border bg-surface">
          <div className="container-gov py-8">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl font-bold text-foreground md:text-4xl">
                APIx Backtesting
              </h1>
              <Tag>APIx Calculated</Tag>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground md:text-base">
              Evaluate the Airfare Price Index using historical airfare observations.
            </p>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Backtesting applies the APIx methodology to historical observations to examine how the
              index behaves over a defined period.
            </p>
          </div>
        </section>

        {/* Configuration */}
        <section className="container-gov pt-8" aria-labelledby="config">
          <div className="rounded-sm border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <h2 id="config" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Backtest Configuration
              </h2>
              <button
                type="button"
                onClick={() => setConfigOpen((v) => !v)}
                aria-expanded={configOpen}
                className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent md:hidden"
              >
                {configOpen ? "Hide" : "Show"} configuration
              </button>
            </div>

            <div
              className={`${configOpen ? "grid" : "hidden"} gap-4 border-t border-border px-4 py-4 md:grid md:grid-cols-2 lg:grid-cols-4`}
            >
              <div>
                <label htmlFor="bt-period" className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Backtest Period
                </label>
                <select
                  id="bt-period"
                  className={`${selectClass} mt-1`}
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                >
                  {AVAILABLE_PERIODS.map((p) => (
                    <option key={p.start} value={p.start}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start {formatDate(periodStart)} · End{" "}
                  {formatDate(
                    (AVAILABLE_PERIODS.find((p) => p.start === periodStart) ?? defaultPeriod).end,
                  )}
                </p>
              </div>

              <div>
                <label htmlFor="bt-airline" className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Airline
                </label>
                <select
                  id="bt-airline"
                  className={`${selectClass} mt-1`}
                  value={airlineCode}
                  onChange={(e) => setAirlineCode(e.target.value)}
                >
                  {AIRLINES.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">Economy airfare observations</p>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                <div className="rounded-sm border border-border bg-background p-3">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Duration</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{BACKTEST_DURATION_DAYS} Days</p>
                </div>
                <div className="rounded-sm border border-border bg-background p-3">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Base Period</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">First observation day</p>
                </div>
                <div className="rounded-sm border border-border bg-background p-3">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Base Index</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">100</p>
                </div>
                <div className="rounded-sm border border-border bg-background p-3">
                  <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Route Basket</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">Top DGCA-weighted routes</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:col-span-4">
                <button
                  type="button"
                  onClick={() => {
                    setRun({ start: periodStart, airline: airlineCode });
                    setPage(0);
                  }}
                  className="inline-flex items-center gap-2 rounded-sm border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-navy"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Run Backtest
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-sm border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Reset
                </button>
                {dirty ? (
                  <span className="text-xs text-muted-foreground">
                    Configuration changed — run the backtest to update results.
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="container-gov pt-8" aria-labelledby="summary">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="summary" className="font-serif text-xl font-bold text-foreground">
              Backtest Summary
            </h2>
            <span
              className={`rounded-sm border px-3 py-1 text-xs font-semibold ${statusTone}`}
              aria-label={`Backtest status: ${result.status}`}
            >
              Backtest Status: {result.status}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card term="Backtest Duration" value={`${result.expectedDays} Days`} note={period.label} />
            <Card term="Observation Days" value={`${result.availableDays} / ${result.expectedDays}`} note="Source Data" />
            <Card term="Airfare Observations" value={result.observations.toLocaleString("en-IN")} note="Source Data" />
            <Card term="Routes Included" value={String(result.routes)} note="DGCA-weighted basket" />
            <Card term="Airlines Included" value={String(result.airlines)} note="Source Data" />
            <Card term="Base Index" value="100" note={`Base day ${formatDate(period.start)}`} />
          </div>
        </section>

        {/* Main chart */}
        <section className="container-gov pt-10" aria-labelledby="bt-chart">
          <div className="rounded-sm border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 id="bt-chart" className="font-serif text-lg font-bold text-foreground">
                30-Day APIx Backtest
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {period.label}
                <Tag>APIx Calculated</Tag>
              </div>
            </div>
            <div className="h-[360px] px-2 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.days} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="currentColor" className="text-border" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => formatDate(v).slice(0, 6)}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    minTickGap={24}
                  />
                  <YAxis
                    domain={["dataMin - 2", "dataMax + 2"]}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    width={48}
                  />
                  <ReferenceLine
                    y={BASE_INDEX}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    strokeDasharray="4 4"
                    label={{ value: "Base = 100", position: "insideBottomRight", fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]!.payload as (typeof result.days)[number];
                      return (
                        <div className="rounded-sm border border-border bg-background p-3 text-xs shadow-card">
                          <p className="font-semibold text-foreground">{formatDate(d.date)}</p>
                          <p className="mt-1 text-muted-foreground">
                            APIx: <span className="tabular-nums text-foreground">{d.index.toFixed(2)}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Daily change:{" "}
                            <span className="tabular-nums text-foreground">{pct(d.dailyChange)}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Observations:{" "}
                            <span className="tabular-nums text-foreground">
                              {d.observations.toLocaleString("en-IN")}
                            </span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="index"
                    stroke="currentColor"
                    className="text-primary"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Route contribution */}
        <section className="container-gov pt-10" aria-labelledby="contribution">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="contribution" className="font-serif text-xl font-bold text-foreground">
              Route Contribution During Backtest
            </h2>
            <div className="flex items-center gap-2">
              <label htmlFor="contrib-sort" className="text-xs text-muted-foreground">
                Sort by
              </label>
              <select
                id="contrib-sort"
                value={contribSort}
                onChange={(e) => setContribSort(e.target.value as ContribSort)}
                className="h-9 rounded-sm border border-border bg-background px-3 text-sm text-foreground"
              >
                <option value="weight">Route Weight</option>
                <option value="fareChange">Fare Change</option>
                <option value="contribution">Contribution</option>
              </select>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-sm border border-border bg-card">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-border bg-surface">
                <tr>
                  <th className={th}>Route</th>
                  <th className={th}>DGCA Weight</th>
                  <th className={th}>Base Fare</th>
                  <th className={th}>Average Fare</th>
                  <th className={th}>Route Index</th>
                  <th className={th}>Contribution</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((r) => (
                  <tr key={r.route} className="border-b border-border last:border-b-0">
                    <td className={`${td} font-medium`}>{r.route}</td>
                    <td className={`${td} tabular-nums`}>{r.weight.toFixed(1)}%</td>
                    <td className={`${td} tabular-nums`}>{inr(r.baseFare)}</td>
                    <td className={`${td} tabular-nums`}>{inr(r.avgFare)}</td>
                    <td className={`${td} tabular-nums`}>{r.index.toFixed(2)}</td>
                    <td className={`${td} tabular-nums`}>
                      <div className="flex items-center gap-2">
                        <span>{r.contribution.toFixed(2)}</span>
                        <span className="hidden h-1.5 w-24 bg-surface sm:block" aria-hidden="true">
                          <span
                            className="block h-full bg-primary"
                            style={{
                              width: `${Math.min(100, (r.contribution / (contributions[0]?.contribution || 1)) * 100)}%`,
                            }}
                          />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Contribution = Route Index × DGCA Route Weight ÷ total basket weight. DGCA weights are
            source data; route indices and contributions are APIx calculated.
          </p>
        </section>

        {/* Highlights */}
        <section className="container-gov pt-10" aria-labelledby="highlights">
          <h2 id="highlights" className="font-serif text-xl font-bold text-foreground">
            Backtest Highlights
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card term="Highest APIx" value={result.highest.index.toFixed(2)} note={formatDate(result.highest.date)} />
            <Card term="Lowest APIx" value={result.lowest.index.toFixed(2)} note={formatDate(result.lowest.date)} />
            <Card
              term="Largest Daily Increase"
              value={pct(result.largestIncrease.dailyChange)}
              note={formatDate(result.largestIncrease.date)}
            />
            <Card
              term="Largest Daily Decrease"
              value={pct(result.largestDecrease.dailyChange)}
              note={formatDate(result.largestDecrease.date)}
            />
            <Card term="Average APIx" value={result.average.toFixed(2)} note="Period mean" />
          </div>
        </section>

        {/* Day-by-day table */}
        <section className="container-gov pt-10" aria-labelledby="daily">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="daily" className="font-serif text-xl font-bold text-foreground">
              Historical APIx Results
            </h2>
            <div>
              <label htmlFor="date-filter" className="sr-only">
                Search or filter by date
              </label>
              <input
                id="date-filter"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Filter by date (e.g. 2026-08)"
                className="h-9 w-64 rounded-sm border border-border bg-background px-3 text-sm text-foreground"
              />
            </div>
          </div>
          <div className="mt-4 overflow-x-auto rounded-sm border border-border bg-card">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-border bg-surface">
                <tr>
                  {(
                    [
                      ["date", "Date"],
                      ["index", "APIx"],
                      ["dailyChange", "Daily Change %"],
                    ] as const
                  ).map(([key, label]) => (
                    <th key={key} className={th}>
                      <button
                        type="button"
                        onClick={() => toggleSort(key)}
                        className="uppercase tracking-[0.1em] hover:text-foreground"
                      >
                        {label}
                        {sortKey === key ? (sortAsc ? " ▲" : " ▼") : ""}
                      </button>
                    </th>
                  ))}
                  <th className={th}>7-Day Change %</th>
                  <th className={th}>Routes Covered</th>
                  <th className={th}>Observations</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td className={`${td} text-muted-foreground`} colSpan={6}>
                      No records match the current filter.
                    </td>
                  </tr>
                ) : (
                  visible.map((d) => (
                    <tr key={d.date} className="border-b border-border last:border-b-0">
                      <td className={`${td} font-medium`}>{formatDate(d.date)}</td>
                      <td className={`${td} tabular-nums`}>{d.index.toFixed(2)}</td>
                      <td className={`${td} tabular-nums`}>{pct(d.dailyChange)}</td>
                      <td className={`${td} tabular-nums`}>{pct(d.weekChange)}</td>
                      <td className={`${td} tabular-nums`}>{d.routesCovered}</td>
                      <td className={`${td} tabular-nums`}>
                        {d.available ? d.observations.toLocaleString("en-IN") : "Not available"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>
              Showing {visible.length} of {tableRows.length} observation days
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={current === 0}
                className="rounded-sm border border-border bg-background px-3 py-1.5 font-medium text-foreground disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {current + 1} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={current >= pageCount - 1}
                className="rounded-sm border border-border bg-background px-3 py-1.5 font-medium text-foreground disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* Coverage + quality */}
        <section className="container-gov grid gap-6 pt-10 lg:grid-cols-2">
          <div className="rounded-sm border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-bold text-foreground">Backtest Data Coverage</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ["Observation Period", period.label],
                ["Expected Days", String(result.expectedDays)],
                ["Available Days", String(result.availableDays)],
                ["Missing Days", String(result.missingDays)],
                ["Total Observations", result.observations.toLocaleString("en-IN")],
                ["Routes", String(result.routes)],
                ["Airlines", String(result.airlines)],
              ].map(([term, value]) => (
                <div key={term}>
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{term}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            {result.missingDays > 0 ? (
              <p className="mt-4 rounded-sm border border-saffron bg-surface px-3 py-2 text-sm text-foreground">
                Partial data coverage — {result.missingDays} observation day
                {result.missingDays === 1 ? "" : "s"} unavailable. Missing observations are excluded
                from the index and are not treated as zero.
              </p>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Full coverage across the selected observation period.
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Observation counts are Source Data; index values are APIx Calculated.
            </p>
          </div>

          <div className="rounded-sm border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-bold text-foreground">Backtest Data Quality</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ["Records before cleaning", result.quality.before],
                ["Records after cleaning", result.quality.after],
                ["Duplicates removed", result.quality.duplicates],
                ["Outliers removed", result.quality.outliers],
                ["Invalid records removed", result.quality.invalid],
                ["Missing observations", result.quality.missing],
              ].map(([term, value]) => (
                <div key={String(term)}>
                  <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{term}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {Number(value).toLocaleString("en-IN")}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              View Data Quality
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Methodology */}
        <section className="container-gov pt-10" aria-labelledby="method">
          <h2 id="method" className="font-serif text-xl font-bold text-foreground">
            Backtesting Methodology
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Historical Airfare Data", "Load stored airfare observations"],
              ["02", "Select 30-Day Period", "Define the backtest window"],
              ["03", "Clean & Standardise", "Remove duplicates, outliers and invalid records"],
              ["04", "Calculate Route Fares", "Average observed fare per route per day"],
              ["05", "Apply DGCA Weights", "Weight routes by passenger traffic"],
              ["06", "Calculate APIx", "Weighted index rebased to 100"],
              ["07", "Evaluate Results", "Examine movement, coverage and contribution"],
            ].map(([step, title, note]) => (
              <li key={step} className="rounded-sm border border-border bg-background p-4">
                <p className="font-serif text-sm font-bold text-primary">{step}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </li>
            ))}
          </ol>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            View Full Methodology
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>

        {/* Validation status + future validation */}
        <section className="container-gov grid gap-6 pt-10 lg:grid-cols-2">
          <div className="rounded-sm border border-border bg-surface p-5">
            <h2 className="font-serif text-lg font-bold text-foreground">Validation Status</h2>
            <p className="mt-3 inline-flex items-center gap-2 rounded-sm border border-primary px-3 py-1 text-sm font-semibold text-primary">
              Historical methodology backtest available
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              The current prototype demonstrates APIx construction using historical airfare
              observations.
            </p>
            {CPI_OVERLAP_AVAILABLE ? null : (
              <p className="mt-2 text-sm text-muted-foreground">
                Official CPI comparison is not available for this historical period.
              </p>
            )}
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Accuracy statistics such as MAE, RMSE, MAPE or correlation are not reported, because no
              overlapping official benchmark series exists for the selected period.
            </p>
          </div>

          <div className="rounded-sm border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-bold text-foreground">Future Validation</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Future versions of APIx may be compared against the following sources once overlapping
              periods are available. These comparisons have not been performed.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-foreground">
              {[
                "Official MoSPI CPI Airfare series",
                "Public aviation statistics",
                "Current airfare observations",
              ].map((item) => (
                <li key={item} className="rounded-sm border border-border bg-background px-3 py-2">
                  {item}
                  <span className="ml-2 text-xs text-muted-foreground">Planned</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Downloads */}
        <section className="container-gov pt-10" aria-labelledby="downloads">
          <div className="rounded-sm border border-border bg-surface p-5">
            <h2 id="downloads" className="font-serif text-lg font-bold text-foreground">
              Download Backtest Results
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Downloads contain the selected backtest period ({period.label}) and its results.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  ["CSV", "csv"],
                  ["Excel", "xls"],
                  ["JSON", "json"],
                ] as const
              ).map(([label, format]) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => exportData(format)}
                  className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={downloadReport}
                className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download Report
              </button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <FloatingUtilities />
    </div>
  );
}
