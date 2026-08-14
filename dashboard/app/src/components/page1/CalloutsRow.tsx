import { priorityCallouts } from "@/data";
import { fmtPct, fmtSignedPctOrMultiple, prettyCategory } from "@/lib/format";
import type { CalloutFlagId } from "@/types/dashboard";

const ICON: Record<CalloutFlagId, string> = {
  fastest_growth: "▲",
  worsening_borough: "↗",
  highest_backlog: "■",
  overloaded_agency: "◆",
  equity_hotspot: "◉",
};

// Keep only the callouts with a direct staffing/priority action; the rest
// (worsening-borough trend, highest-backlog agency) duplicate signal already
// on this page's KPI row and Priority signals panel, and crowded out the
// ones below when all five were shown at once.
const ACTIONABLE_FLAGS: CalloutFlagId[] = [
  "fastest_growth",
  "overloaded_agency",
  "equity_hotspot",
];

export default function CalloutsRow() {
  const visible = priorityCallouts.filter((c) =>
    ACTIONABLE_FLAGS.includes(c.flag_id),
  );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {visible.map((c) => {
        const display =
          c.flag_id === "overloaded_agency"
            ? `×${(c.value / 100).toFixed(1)}`
            : c.flag_id === "equity_hotspot"
              ? fmtSignedPctOrMultiple(c.value, false)
              : fmtPct(c.value, 1, false);
        const entityClean =
          c.flag_id === "overloaded_agency"
            ? c.entity.replace(/\((.+?)\)/, (_, cat: string) => `(${prettyCategory(cat)})`)
            : prettyCategory(c.entity);
        return (
          <div
            key={c.flag_id}
            className="card flex flex-col gap-1.5 p-4"
            aria-label={c.label}
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              <span aria-hidden className="text-state-critical">
                {ICON[c.flag_id]}
              </span>
              {c.label}
            </div>
            <div
              className="truncate text-base font-semibold text-ink"
              title={entityClean}
            >
              {entityClean}
            </div>
            <div className="text-2xl font-bold text-state-critical">
              {display}
            </div>
          </div>
        );
      })}
    </div>
  );
}
