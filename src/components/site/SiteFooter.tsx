import { Landmark, Mail, Rss, Share2 } from "lucide-react";

const COLUMNS = [
  {
    title: "APIx",
    links: ["About APIx", "Methodology", "Airfare Index", "Route Analytics"],
  },
  {
    title: "Data",
    links: ["Data Sources", "Explore Data", "CPI Benchmark", "Backtesting"],
  },
  {
    title: "Information",
    links: ["Privacy Policy", "Accessibility Statement", "Terms of Use", "Copyright Policy"],
  },
  {
    title: "Connect",
    links: ["Contact", "Feedback", "Help & FAQ", "Website Policies"],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-navy text-navy-foreground">
      <div className="container-gov grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-navy-foreground/25"
              aria-hidden="true"
            >
              <Landmark className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <div className="text-sm leading-tight">
              <p className="font-semibold">Government of India</p>
              <p className="text-navy-foreground/80">
                Ministry of Statistics and Programme Implementation
              </p>
            </div>
          </div>
          <p className="mt-5 font-serif text-xl font-bold">APIx</p>
          <p className="text-sm text-navy-foreground/80">
            Real-time Airfare Price Index for India — an analytical platform for monitoring
            domestic airfare movements.
          </p>
          <div className="mt-5 flex gap-2">
            {[
              { icon: Share2, label: "Official social media handle" },
              { icon: Mail, label: "Email the APIx team" },
              { icon: Rss, label: "Data release notifications" },
            ].map(({ icon: Icon, label }) => (
              <a
                key={label}
                href="/contact"
                aria-label={label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-navy-foreground/25 transition-colors hover:bg-navy-foreground/10"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-navy-foreground/70">
              {column.title}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link}>
                  <a
                    href={`/${link.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "")}`}
                    className="text-sm text-navy-foreground/85 underline-offset-4 transition-colors hover:text-navy-foreground hover:underline"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-navy-foreground/15">
        <div className="container-gov flex flex-col gap-2 py-5 text-xs text-navy-foreground/75 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} Ministry of Statistics and Programme Implementation,
            Government of India. All rights reserved.
          </p>
          <p>
            APIx is an analytical product. Source statistics remain the property of their
            respective publishing agencies.
          </p>
        </div>
      </div>
    </footer>
  );
}
