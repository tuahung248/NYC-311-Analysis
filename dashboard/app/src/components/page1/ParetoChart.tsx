import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { pareto } from "@/data";
import { useFilters } from "@/context/FilterContext";
import { fmtCount, fmtPct, prettyCategory } from "@/lib/format";

export default function ParetoChart() {
  const { topN, category, setCategory } = useFilters();

  const data = useMemo(() => {
    return [...pareto]
      .sort((a, b) => b.request_count - a.request_count)
      .map((row) => {
        const full = prettyCategory(row.operational_category);
        return {
          ...row,
          short: full,
          // Axis tick label only — long category names were overlapping at
          // a -32deg angle. Full name is still shown in the tooltip.
          axisLabel: full.length > 16 ? `${full.slice(0, 15)}…` : full,
          bandColor: row.cumulative_pct <= 80 ? "var(--accent-blue)" : "var(--accent-orange)",
        };
      });
  }, []);

  const concentration = useMemo(() => {
    const total = data.reduce((acc, r) => acc + r.request_count, 0) || 1;
    const topSum = data
      .slice(0, topN)
      .reduce((acc, r) => acc + r.request_count, 0);
    return (topSum / total) * 100;
  }, [data, topN]);

  return (
    <div className="space-y-2">
      <div className="rounded-md bg-ink-soft px-3 py-2 text-sm text-ink">
        <strong>Top {topN} categories drive {concentration.toFixed(1)}%</strong>{" "}
        of total volume.
      </div>
      <div className="h-[340px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 16, right: 56, bottom: 92, left: 8 }}
            onClick={(e) => {
              const payload = (e?.activePayload ?? [])[0]?.payload as
                | { operational_category?: string }
                | undefined;
              if (payload?.operational_category) {
                setCategory(
                  payload.operational_category === category
                    ? "(All)"
                    : payload.operational_category,
                );
              }
            }}
          >
            <CartesianGrid stroke="var(--neutral-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="axisLabel"
              interval={0}
              tick={{ fontSize: 11, fill: "var(--neutral-text)" }}
              angle={-40}
              textAnchor="end"
              height={92}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "var(--neutral-text)" }}
              tickFormatter={(v: number) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1_000
                    ? `${(v / 1_000).toFixed(0)}k`
                    : `${v}`
              }
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "var(--neutral-text)" }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <ReferenceLine
              y={80}
              yAxisId="right"
              stroke="var(--neutral-muted)"
              strokeDasharray="4 4"
              label={{
                value: "80%",
                position: "right",
                fill: "var(--neutral-muted)",
                fontSize: 11,
              }}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const r = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-md border border-ink-grid bg-white px-3 py-2 text-xs shadow-md">
                    <div className="font-semibold text-ink">{r.short}</div>
                    <div className="text-ink-muted">
                      Volume: {fmtCount(r.request_count)} (
                      {fmtPct(r.pct_of_total, 1, true)})
                    </div>
                    <div className="text-ink-muted">
                      Cumulative: {fmtPct(r.cumulative_pct, 1, true)}
                    </div>
                    <div className="text-ink-muted">
                      Closed: {fmtCount(r.closed_count)} &middot; Open:{" "}
                      {fmtCount(r.open_count)}
                    </div>
                    <div className="mt-1 text-[10px] text-ink-muted">
                      Click to filter the dashboard by this category
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={24}
              iconSize={10}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Bar
              yAxisId="left"
              name="Volume (top 80%)"
              dataKey="request_count"
              fill="var(--accent-blue)"
              isAnimationActive={false}
              shape={(props: unknown) => {
                const p = props as {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                  payload: (typeof data)[number];
                };
                const fill =
                  p.payload.cumulative_pct <= 80
                    ? "var(--accent-blue)"
                    : "var(--accent-orange)";
                const isSelected =
                  category === p.payload.operational_category;
                const stroke = isSelected ? "var(--neutral-text)" : "none";
                return (
                  <rect
                    x={p.x}
                    y={p.y}
                    width={p.width}
                    height={p.height}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2 : 0}
                    rx={2}
                  />
                );
              }}
            />
            <Line
              yAxisId="right"
              name="Cumulative %"
              type="monotone"
              dataKey="cumulative_pct"
              stroke="var(--neutral-text)"
              strokeWidth={2}
              dot={{ r: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-accent-blue" /> Top
          80% (Pareto)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-accent-orange" />{" "}
          Long tail
        </span>
        <span className="ml-auto italic">Click a bar to drill the dashboard.</span>
      </div>
    </div>
  );
}
