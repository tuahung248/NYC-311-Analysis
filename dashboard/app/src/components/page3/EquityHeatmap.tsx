import { useMemo } from "react";
import type { EquityHeatmapRow, IncomeQuartile } from "@/types/dashboard";
import { fmtCount, fmtSignedPctOrMultiple } from "@/lib/format";
import type { AnchorMode } from "./EquityLens";

type FixedUnit = "min" | "h" | "d";

// fmtMinutes auto-picks a unit per value (min/h/d), which is fine for a
// single stat but makes a grid of cells hard to compare at a glance when
// neighbouring cells land in different units. Pick one unit for the whole
// table based on its largest value, and format every cell in it.
function pickFixedUnit(maxMinutes: number): FixedUnit {
  if (maxMinutes >= 60 * 24) return "d";
  if (maxMinutes >= 60) return "h";
  return "min";
}

function fmtFixedUnit(minutes: number | null, unit: FixedUnit): string {
  if (minutes === null || Number.isNaN(minutes)) return "—";
  if (unit === "d") return `${(minutes / (60 * 24)).toFixed(1)} d`;
  if (unit === "h") return `${(minutes / 60).toFixed(1)} h`;
  return `${Math.round(minutes)} min`;
}

interface Props {
  rows: EquityHeatmapRow[];
  allRows: EquityHeatmapRow[];
  metric: "median" | "gap";
  anchorMode: AnchorMode;
}

const QUARTILES: IncomeQuartile[] = ["1", "2", "3", "4"];
const QUARTILE_LABELS: Record<IncomeQuartile, string> = {
  "1": "Q1",
  "2": "Q2",
  "3": "Q3",
  "4": "Q4",
  UNKNOWN: "Unk",
};

const BOROUGHS = ["BRONX", "BROOKLYN", "MANHATTAN", "QUEENS", "STATEN ISLAND"];

function colorFor(metric: "median" | "gap", value: number, range: [number, number]) {
  const [lo, hi] = range;
  if (hi === lo) return "#cccccc";
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  if (metric === "gap") {
    if (value < 0) {
      const k = Math.max(0, Math.min(1, -value / Math.abs(lo || 1)));
      return mix("#0072B2", "#F4F4F5", 1 - k);
    }
    const k = Math.max(0, Math.min(1, value / Math.abs(hi || 1)));
    return mix("#F4F4F5", "#D55E00", k);
  }
  return mix("#0072B2", "#D55E00", t);
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export default function EquityHeatmap({ rows, allRows, metric, anchorMode }: Props) {
  const gapField: "gap_vs_q4_pct" | "gap_vs_city_pct" =
    anchorMode === "q4" ? "gap_vs_q4_pct" : "gap_vs_city_pct";

  const monotonicByBorough = useMemo(() => {
    const map = new Map<string, boolean | null>();
    for (const r of allRows) {
      if (!map.has(r.borough)) map.set(r.borough, r.gradient_monotonic);
    }
    return map;
  }, [allRows]);

  const { matrix, range } = useMemo(() => {
    const m = new Map<string, EquityHeatmapRow>();
    for (const row of rows) {
      m.set(`${row.borough}|${row.income_quartile}`, row);
    }
    const numeric: number[] = [];
    for (const r of rows) {
      if (r.is_low_sample) continue;
      const v =
        metric === "median" ? r.median_resolution_minutes : r[gapField];
      if (v !== null && Number.isFinite(v)) numeric.push(v);
    }
    const lo = numeric.length ? Math.min(...numeric) : 0;
    const hi = numeric.length ? Math.max(...numeric) : 1;
    return { matrix: m, range: [lo, hi] as [number, number] };
  }, [rows, metric, gapField]);

  const timeUnit = useMemo(() => {
    const all = rows
      .map((r) => r.median_resolution_minutes)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    return pickFixedUnit(all.length ? Math.max(...all) : 0);
  }, [rows]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-40 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Borough \ Income
            </th>
            {QUARTILES.map((q) => (
              <th
                key={q}
                className="text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted"
              >
                {QUARTILE_LABELS[q]}
                {q === "1" && (
                  <span className="ml-1 text-[10px] font-normal text-ink-muted">(low income)</span>
                )}
                {q === "4" && (
                  <span className="ml-1 text-[10px] font-normal text-ink-muted">(high income)</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BOROUGHS.map((borough) => {
            const monotonic = monotonicByBorough.get(borough);
            const isNonMonotonic = monotonic === false;
            return (
              <tr key={borough}>
                <th className="text-left text-xs font-semibold text-ink">
                  <div className="flex items-center gap-1.5">
                    <span>{borough}</span>
                    {isNonMonotonic && (
                      <span
                        className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-state-watch/60 text-[9px] font-semibold text-[#7a5400]"
                        title="Non-monotonic income gradient — Q1 to Q4 medians do not strictly improve. May reflect a single-ZIP quartile bucket. See docs/equity_quartile_audit.md."
                      >
                        i
                      </span>
                    )}
                  </div>
                </th>
                {QUARTILES.map((q) => {
                  const row = matrix.get(`${borough}|${q}`);
                  if (!row) {
                    const allRow = allRows.find(
                      (r) => r.borough === borough && r.income_quartile === q,
                    );
                    const subText = allRow
                      ? `n=${fmtCount(allRow.closed_request_count)} (below threshold)`
                      : "no data";
                    return (
                      <td
                        key={q}
                        className="rounded-md border border-dashed border-ink-grid bg-white p-3 text-center text-[11px] italic text-ink-muted"
                        title={
                          allRow
                            ? `${borough} · ${QUARTILE_LABELS[q]}\nClosed: ${fmtCount(allRow.closed_request_count)} (below current min sample)`
                            : `${borough} · ${QUARTILE_LABELS[q]}\nNo records — no ZIPs in this income quartile filed parking enforcement complaints in this borough.`
                        }
                      >
                        {subText}
                      </td>
                    );
                  }
                  const isLow = row.is_low_sample;
                  const value =
                    metric === "median"
                      ? row.median_resolution_minutes
                      : row[gapField];
                  const bg = isLow
                    ? "#EDEDED"
                    : value === null
                      ? "#EDEDED"
                      : colorFor(metric, value, range);
                  const textColor = isLow ? "var(--neutral-muted)" : "#ffffff";
                  const anchorTooltip =
                    anchorMode === "q4"
                      ? `Vs Q4 (within borough): ${fmtSignedPctOrMultiple(row.gap_vs_q4_pct)}`
                      : `Vs city median: ${fmtSignedPctOrMultiple(row.gap_vs_city_pct)}`;
                  return (
                    <td
                      key={q}
                      className="relative h-[78px] rounded-md p-2 align-middle"
                      style={{
                        background: bg,
                        color: textColor,
                      }}
                      title={`${borough} · ${QUARTILE_LABELS[q]}\nMedian: ${fmtFixedUnit(row.median_resolution_minutes, timeUnit)}\nClosed: ${fmtCount(row.closed_request_count)}\n${anchorTooltip}\n${row.confidence_label}${row.suppression_reason ? `\nNote: ${row.suppression_reason}` : ""}${isNonMonotonic ? "\n\nNon-monotonic gradient flag — Q1->Q4 not strictly improving." : ""}`}
                    >
                      {isLow ? (
                        <div className="text-center text-[11px]">
                          <div>low n</div>
                          <div className="text-[10px]">
                            {fmtCount(row.closed_request_count)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center leading-tight">
                          <div className="text-[13px] font-bold">
                            {metric === "median"
                              ? fmtFixedUnit(row.median_resolution_minutes, timeUnit)
                              : fmtSignedPctOrMultiple(row[gapField])}
                          </div>
                          <div className="text-[10px] opacity-90">
                            n={fmtCount(row.closed_request_count)}
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-equity-fast" />{" "}
          Faster
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-equity-slow" />{" "}
          Slower
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#EDEDED]" /> Low
          confidence (n &lt; threshold)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-state-watch/60 text-[9px] font-semibold text-[#7a5400]">
            i
          </span>
          Q1-&gt;Q4 gradient does not strictly improve
        </span>
      </div>
    </div>
  );
}
