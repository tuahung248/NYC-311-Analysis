import { useMemo } from "react";
import { monthlyTrend, prioritySignals } from "@/data";
import { useFilters } from "@/context/FilterContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { fmtSignedPct, prettyCategory } from "@/lib/format";
import type { PriorityState } from "@/types/dashboard";

const STATE_RANK: Record<PriorityState, number> = {
  Critical: 0,
  Watch: 1,
  Stable: 2,
  "Insufficient Data": 3,
};

const TREND_TONE: Record<PriorityState, string> = {
  Critical: "#D55E00",
  Watch: "#E69F00",
  Stable: "#56B4E9",
  "Insufficient Data": "#999999",
};

const SPARK_WIDTH = 88;
const SPARK_HEIGHT = 22;
const TREND_MONTHS = 12;

interface SparklineProps {
  series: number[];
  color: string;
}

function Sparkline({ series, color }: SparklineProps) {
  if (series.length < 2) {
    return (
      <div
        aria-hidden
        className="flex items-center justify-center text-[9px] text-ink-muted"
        style={{ width: SPARK_WIDTH, height: SPARK_HEIGHT }}
      >
        n/a
      </div>
    );
  }
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  const span = hi - lo || 1;
  const stepX = SPARK_WIDTH / (series.length - 1);
  const points = series
    .map((v, i) => {
      const x = i * stepX;
      const y = SPARK_HEIGHT - ((v - lo) / span) * SPARK_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastX = (series.length - 1) * stepX;
  const lastY =
    SPARK_HEIGHT - ((series[series.length - 1] - lo) / span) * SPARK_HEIGHT;
  return (
    <svg
      width={SPARK_WIDTH}
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      role="img"
      aria-label={`Last ${series.length} months trend`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}

export default function PriorityPanel() {
  const { setCategory, category, borough } = useFilters();

  const trendByCategory = useMemo(() => {
    const totals = new Map<string, Map<string, number>>();
    for (const row of monthlyTrend) {
      if (borough !== "(All)" && row.borough !== borough) continue;
      const cat = row.operational_category;
      const month = String(row.created_month).slice(0, 10);
      const inner = totals.get(cat) ?? new Map<string, number>();
      inner.set(month, (inner.get(month) ?? 0) + row.request_count);
      totals.set(cat, inner);
    }
    const out = new Map<string, number[]>();
    for (const [cat, perMonth] of totals) {
      const months = Array.from(perMonth.keys()).sort();
      const tail = months.slice(-TREND_MONTHS);
      out.set(
        cat,
        tail.map((m) => perMonth.get(m) ?? 0),
      );
    }
    return out;
  }, [borough]);

  const ranked = useMemo(() => {
    const scoped =
      category === "(All)"
        ? prioritySignals
        : prioritySignals.filter(
            (row) => row.operational_category === category,
          );
    return [...scoped]
      .sort((a, b) => {
        const sa = STATE_RANK[a.priority_state] ?? 9;
        const sb = STATE_RANK[b.priority_state] ?? 9;
        if (sa !== sb) return sa - sb;
        return (b.priority_score ?? -Infinity) - (a.priority_score ?? -Infinity);
      })
      .slice(0, category === "(All)" ? 8 : scoped.length);
  }, [category]);

  return (
    <ul className="divide-y divide-ink-grid">
      {ranked.map((row) => {
        const selected = category === row.operational_category;
        const series = trendByCategory.get(row.operational_category) ?? [];
        const tone = TREND_TONE[row.priority_state] ?? "#56B4E9";
        return (
          <li key={row.operational_category}>
            <button
              type="button"
              onClick={() =>
                setCategory(selected ? "(All)" : row.operational_category)
              }
              aria-pressed={selected}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                selected ? "bg-ink-soft" : "hover:bg-ink-soft/60"
              }`}
              title={`Score ${row.priority_score?.toFixed(2) ?? "n/a"} | Driver: ${row.primary_driver ?? "n/a"} | Trend: last ${series.length} months`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {prettyCategory(row.operational_category)}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-muted">
                  <span>
                    Score{" "}
                    <strong className="text-ink">
                      {row.priority_score?.toFixed(2) ?? "—"}
                    </strong>
                  </span>
                  <span>·</span>
                  <span>
                    Driver:{" "}
                    <strong className="text-ink">
                      {row.primary_driver ?? "—"}
                    </strong>
                  </span>
                  {row.growth_pct !== null && (
                    <>
                      <span>·</span>
                      <span>YoY {fmtSignedPct(row.growth_pct)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Sparkline series={series} color={tone} />
                <StatusBadge state={row.priority_state} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
