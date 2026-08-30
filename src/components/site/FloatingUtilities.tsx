import { useState } from "react";
import { MessageSquareText, Sparkle, X } from "lucide-react";

const EXAMPLE_QUESTIONS = [
  "How has airfare changed in the last 30 days?",
  "Which route recorded the highest increase?",
  "What does an APIx value of 108 mean?",
  "How is APIx calculated?",
];


export function FloatingUtilities() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div className="container-gov flex flex-col items-end gap-2 pb-4">
        {open ? (
          <div className="pointer-events-auto w-full max-w-sm rounded-sm border border-border bg-card p-4 shadow-raised">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Ask APIx</p>
                <p className="text-xs text-muted-foreground">
                  Ask questions about the Airfare Price Index.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Ask APIx"
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {EXAMPLE_QUESTIONS.map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    className="w-full rounded-sm border border-border bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Responses will be generated from published APIx data.
            </p>
          </div>
        ) : null}

        <div className="flex gap-2">
          <a
            href="/feedback"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-card transition-colors hover:bg-accent"
          >
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Feedback
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-sm border border-primary bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-navy"
          >
            <Sparkle className="h-4 w-4" aria-hidden="true" />
            Ask APIx
          </button>
        </div>
      </div>
    </div>
  );
}
