import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Accessibility,
  ChevronDown,
  Landmark,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
  { code: "bn", label: "বাংলা" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
];

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Airfare Index", href: "/airfare-index" },
  { label: "Explore Data", href: "/explore-data" },
  { label: "Route Analytics", href: "/route-analytics" },
  { label: "Trends", href: "/trends" },
  { label: "Lead-Time", href: "/lead-time" },
  { label: "Backtesting", href: "/backtesting" },
  { label: "CPI Benchmark", href: "/cpi-benchmark" },
  { label: "Data Sources", href: "/data-sources" },
  { label: "About APIx", href: "/about" },
];

const utilityButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

export function SiteHeader() {
  const { theme, toggleTheme } = useTheme();
  const [language, setLanguage] = useState("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);

  function toggleLargeText() {
    const next = !largeText;
    setLargeText(next);
    document.documentElement.style.fontSize = next ? "112.5%" : "";
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="tricolour-rule" aria-hidden="true" />

      {/* Identity bar */}
      <div className="border-b border-border bg-surface">
        <div className="container-gov flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-primary"
              aria-hidden="true"
            >
              <Landmark className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <div className="leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Government of India
              </p>
              <p className="text-sm font-semibold text-foreground">
                Ministry of Statistics and Programme Implementation
              </p>
              <p className="text-[11px] text-muted-foreground">Data &amp; Statistics</p>
            </div>
          </div>

          <div className="hidden items-center gap-3 border-l border-border pl-6 lg:flex">
            <span
              className="font-serif text-2xl font-bold tracking-tight text-primary"
              aria-hidden="true"
            >
              APIx
            </span>
            <span className="text-xs leading-tight text-muted-foreground">
              Real-time Airfare
              <br />
              Price Index
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <label htmlFor="language-select" className="sr-only">
                Select interface language
              </label>
              <select
                id="language-select"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="h-9 appearance-none rounded-sm border border-border bg-background py-0 pl-3 pr-8 text-sm text-foreground transition-colors hover:bg-accent"
              >
                {LANGUAGES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </div>

            <button type="button" className={utilityButton} aria-label="Search the portal">
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={toggleLargeText}
              aria-pressed={largeText}
              className={utilityButton}
              aria-label="Increase text size for accessibility"
            >
              <Accessibility className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className={utilityButton}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className={`${utilityButton} lg:hidden`}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              aria-label="Toggle main navigation"
            >
              {menuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Primary navigation */}
      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={`${menuOpen ? "block" : "hidden"} border-b border-border bg-navy text-navy-foreground lg:block`}
      >
        <ul className="container-gov flex flex-col lg:flex-row lg:items-center">
          {NAV_ITEMS.map((item) =>
            item.href === "/" ? (
              <li key={item.label}>
                <Link
                  to="/"
                  className="block border-b border-navy-foreground/10 px-3 py-3 text-sm font-medium text-navy-foreground/95 transition-colors hover:bg-navy-foreground/10 lg:border-b-0 lg:border-t-2 lg:border-t-saffron lg:py-3"
                >
                  {item.label}
                </Link>
              </li>
            ) : (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="block border-b border-navy-foreground/10 px-3 py-3 text-sm font-medium text-navy-foreground/85 transition-colors hover:bg-navy-foreground/10 lg:border-b-0 lg:border-t-2 lg:border-t-transparent"
                >
                  {item.label}
                </a>
              </li>
            ),
          )}
        </ul>
      </nav>
    </header>
  );
}
