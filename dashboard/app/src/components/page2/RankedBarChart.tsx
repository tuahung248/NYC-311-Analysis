import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgencyBenchmarkRow } from "@/types/dashboard";
import { fmtCount, fmtMinutes, fmtSignedPct, prettyCategory } from "@/lib/format";

const BAND_COLOR: Record<string, string> = {
  "Top Quartile (Fast)": "#0072B2",
  "Above Median": "#56B4E9",
  "Below Median": "#E69F00",
  "Bottom Quartile (Slow)": "#D55E00",
  "Insufficient Data": "#999999",
};

interface Props {
  rows: AgencyBenchmarkRow[];
  baselineLabel: string;
  baselineValue: number;
}

function isDohmh(agency: string): boolean {
  return agency.toUpperCase().startsWith("DOHMH");
}

const DEFAULT_VISIBLE = 15;

export default function RankedBarChart({ rows, baselineLabel, baselineValue }: Props) {
  const [expanded, setExpanded] = useState(false);

  const data = useMemo(() => {
    return [...rows]
      // Slowest first — this is a "where's the problem" chart, so the row
      // that most needs attention should be the first thing scanned.
      .sort(
        (a, b) =>
          b.median_resolution_minutes - a.median_resolution_minutes,
      )
      .map((row) => {
        const dohmh = isDohmh(row.agency);
        const categoryTag = prettyCategory(row.operational_category);
        const baseLabel = row.is_low_sample
          ? `${row.agency} · ${categoryTag} (low n)`
          : `${row.agency} · ${categoryTag}`;
        return {
          ...row,
          is_dohmh: dohmh,
          label: dohmh ? `${baseLabel} \u26A0` : baseLabel,
        };
      });
  }, [rows]);

  const axisStats = useMemo(() => {
    const eligible = data.filter((d) => !d.is_low_sample && !d.is_dohmh);
    const pool = eligible.length > 0 ? eligible : data.filter((d) => !d.is_dohmh);
    const values = pool
      .map((d) => d.median_resolution_minutes)
      .filter((v): v is number => Number.isFinite(v) && v >= 0)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return { axisMax: Math.max(1, baselineValue), truncated: false };
    }

    const p75Idx = Math.floor((values.length - 1) * 0.75);
    const p75 = values[p75Idx] ?? values[values.length - 1];
    const baselineForScale = Math.max(baselineValue, 1);
    const axisMax = Math.min(
      Math.max(baselineForScale * 2.5, p75 * 1.5, 60),
      baselineForScale * 5,
    );
    const hardMax = data.length > 0
      ? Math.max(...data.map((d) => d.median_resolution_minutes))
      : axisMax;

    return { axisMax, truncated: hardMax > axisMax };
  }, [data, baselineValue]);

  const displayData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        display_minutes: Math.min(d.median_resolution_minutes, axisStats.axisMax),
      })),
    [data, axisStats.axisMax],
  );

  const visibleData =
    expanded || displayData.length <= DEFAULT_VISIBLE
      ? displayData
      : displayData.slice(0, DEFAULT_VISIBLE);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md bg-ink-soft text-sm text-ink-muted">
        No agencies match the current filters.
      </div>
    );
  }

  const chartHeight = Math.max(220, visibleData.length * 28 + 40);

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-ink-soft px-3 py-2 text-sm text-ink">
        Reference: <strong>{baselineLabel}</strong> ={" "}
        <strong>{fmtMinutes(baselineValue)}</strong>. Bars show median
        resolution per agency; coloured by performance band; low-sample bars
        muted.
      </div>
      {axisStats.truncated && (
        <div className="rounded-md border border-state-watch/40 bg-[#FFF8EA] px-3 py-2 text-[11px] text-[#7a5400]">
          Axis is capped to keep bars readable in <code>(All)</code> view.
          Outlier rows are clipped visually; hover tooltips show true medians.
        </div>
      )}
      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={visibleData}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 60 }}
          >
            <CartesianGrid stroke="var(--neutral-grid)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, axisStats.axisMax]}
              tick={{ fontSize: 11, fill: "var(--neutral-text)" }}
              tickFormatter={(v: number) => fmtMinutes(v)}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={200}
              tick={{ fontSize: 11, fill: "var(--neutral-text)" }}
            />
            <ReferenceLine
              x={baselineValue}
              stroke="var(--neutral-text)"
              strokeDasharray="4 4"
              label={{
                value: baselineLabel.replace(/\s*\(.+\)\s*$/, ""),
                fill: "var(--neutral-text)",
                fontSize: 11,
                position: "insideTopRight",
              }}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const r = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-md border border-ink-grid bg-white px-3 py-2 text-xs shadow-md">
                    <div className="font-semibold text-ink">
                      {r.agency} · {r.operational_category}
                    </div>
                    <div className="text-ink-muted">
                      Median: {fmtMinutes(r.median_resolution_minutes)}
                    </div>
                    <div className="text-ink-muted">
                      Closed: {fmtCount(r.closed_request_count)}
                    </div>
                    <div className="text-ink-muted">
                      vs Category: {fmtSignedPct(r.category_deviation_pct)}
                    </div>
                    <div className="text-ink-muted">
                      vs City: {fmtSignedPct(r.city_deviation_pct)}
                    </div>
                    <div className="mt-1 text-[10px] italic text-ink-muted">
                      Band: {r.percentile_band} · {r.confidence_label}
                    </div>
                    {r.is_dohmh && (
                      <div className="mt-1 rounded-sm bg-[#FCEBC9] px-1.5 py-0.5 text-[10px] font-semibold text-[#7a5400]">
                        &#9888; DOHMH data-quality caveat
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Bar dataKey="display_minutes" isAnimationActive={false}>
              {visibleData.map((row) => (
                <Cell
                  key={row.agency + row.operational_category}
                  fill={
                    row.is_low_sample
                      ? "var(--neutral-muted)"
                      : (BAND_COLOR[row.percentile_band] ??
                        "var(--neutral-muted)")
                  }
                  fillOpacity={row.is_low_sample ? 0.4 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {displayData.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-md border border-ink-grid px-3 py-1.5 text-xs font-medium text-ink hover:bg-ink-soft"
        >
          {expanded
            ? `Show top ${DEFAULT_VISIBLE} slowest only`
            : `Show all ${displayData.length} agencies`}
        </button>
      )}
      <Legend />
    </div>
  );
}

function Legend() {
  const items: { label: string; color: string }[] = [
    { label: "Top Quartile (Fast)", color: BAND_COLOR["Top Quartile (Fast)"] },
    { label: "Above Median", color: BAND_COLOR["Above Median"] },
    { label: "Below Median", color: BAND_COLOR["Below Median"] },
    { label: "Bottom Quartile (Slow)", color: BAND_COLOR["Bottom Quartile (Slow)"] },
    { label: "Low confidence", color: "#999999" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: i.color }}
          />
          {i.label}
        </span>
      ))}
      <span
        className="inline-flex items-center gap-1"
        title="DOHMH resolution data is known to be inconsistent in this dataset family."
      >
        <span aria-hidden className="text-[#7a5400]">&#9888;</span>
        DOHMH caveat
      </span>
    </div>
  );
}
