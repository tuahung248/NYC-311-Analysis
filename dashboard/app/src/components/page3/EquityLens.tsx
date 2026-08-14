import { useMemo, useState } from "react";
import Card from "@/components/shared/Card";
import FilterBar from "@/components/shared/FilterBar";
import PageHeader from "@/components/shared/PageHeader";
import { equityHeatmap, prioritySignals } from "@/data";
import { useFilters } from "@/context/FilterContext";
import {
  fmtCount,
  fmtMinutes,
  fmtSignedPctOrMultiple,
  isExtremePct,
  prettyCategory,
} from "@/lib/format";
import EquityHeatmap from "./EquityHeatmap";
import SampleSizeStrip from "./SampleSizeStrip";

export type AnchorMode = "q4" | "city";

export default function EquityLens() {
  const { category, minSample, setCategory } = useFilters();
  const [metric, setMetric] = useState<"median" | "gap">("median");
  const [anchorMode, setAnchorMode] = useState<AnchorMode>("q4");

  const effectiveCategory = useMemo(() => {
    if (category !== "(All)") return category;
    const ranked = prioritySignals
      .filter(
        (r) =>
          r.equity_z !== null &&
          Number.isFinite(r.equity_z) &&
          r.latest_count >= 100,
      )
      .slice()
      .sort((a, b) => {
        const za = a.equity_z ?? -Infinity;
        const zb = b.equity_z ?? -Infinity;
        if (zb !== za) return zb - za;
        const ga = a.equity_gap_pct ?? -Infinity;
        const gb = b.equity_gap_pct ?? -Infinity;
        return gb - ga;
      });
    return ranked[0]?.operational_category ?? null;
  }, [category]);

  const rows = useMemo(() => {
    if (!effectiveCategory) return [];
    return equityHeatmap.filter(
      (r) => r.operational_category === effectiveCategory,
    );
  }, [effectiveCategory]);

  const visibleRows = useMemo(
    () => rows.filter((r) => r.closed_request_count >= minSample),
    [rows, minSample],
  );

  const callouts = useMemo(() => {
    const reliableQ1 = rows.filter(
      (r) => !r.is_low_sample && r.income_quartile === "1",
    );
    if (anchorMode === "q4") {
      const withGap = reliableQ1.filter(
        (r) => r.gap_vs_q4_pct !== null && Number.isFinite(r.gap_vs_q4_pct),
      );
      const worst = withGap
        .slice()
        .sort(
          (a, b) =>
            (b.gap_vs_q4_pct ?? -Infinity) - (a.gap_vs_q4_pct ?? -Infinity),
        )[0];
      const best = withGap
        .slice()
        .sort(
          (a, b) =>
            (a.gap_vs_q4_pct ?? Infinity) - (b.gap_vs_q4_pct ?? Infinity),
        )[0];
      const missingQ4 = reliableQ1
        .filter(
          (r) =>
            r.gap_vs_q4_pct === null ||
            !Number.isFinite(r.gap_vs_q4_pct ?? NaN),
        )
        .map((r) => r.borough);
      return { worst, best, missingQ4 };
    }
    const withGap = reliableQ1.filter(
      (r) => r.gap_vs_city_pct !== null && Number.isFinite(r.gap_vs_city_pct),
    );
    const worst = withGap
      .slice()
      .sort(
        (a, b) =>
          (b.gap_vs_city_pct ?? -Infinity) - (a.gap_vs_city_pct ?? -Infinity),
      )[0];
    const best = withGap
      .slice()
      .sort(
        (a, b) =>
          (a.gap_vs_city_pct ?? Infinity) - (b.gap_vs_city_pct ?? Infinity),
      )[0];
    return { worst, best, missingQ4: [] as string[] };
  }, [rows, anchorMode]);

  const anchorLabel =
    anchorMode === "q4" ? "Q4 within borough" : "City median (fallback)";
  const gapKey: "gap_vs_q4_pct" | "gap_vs_city_pct" =
    anchorMode === "q4" ? "gap_vs_q4_pct" : "gap_vs_city_pct";

  const equityZForChosen = useMemo(() => {
    if (!effectiveCategory) return null;
    const match = prioritySignals.find(
      (r) => r.operational_category === effectiveCategory,
    );
    return match?.equity_z ?? null;
  }, [effectiveCategory]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Page 3 — Equity Risk Lens"
        title="Are residents getting equally fast service?"
        description="Borough × ZIP-level income quartile, anchored to Q4 (highest-income) within each (borough, category). Switch the anchor to City median for boroughs whose Q4 is missing or thin."
        ribbon={
          <div className="rounded-md border border-state-critical/40 bg-[#FBE4D6] px-3 py-2 text-xs text-[#7a3300]">
            <strong>Under-reporting bias caveat:</strong> low-income and
            minority neighbourhoods file fewer 311 requests despite higher
            objective need. Treat geographic hotspots as a floor on the gap,
            not a ceiling.
          </div>
        }
      />

      <FilterBar
        show={{
          category: true,
          borough: false,
          minSample: true,
        }}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-ink-grid bg-white p-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Cell metric
          </span>
          <div
            role="tablist"
            aria-label="Heatmap metric"
            className="inline-flex overflow-hidden rounded-md border border-ink-grid"
          >
            <button
              type="button"
              role="tab"
              aria-selected={metric === "median"}
              onClick={() => setMetric("median")}
              className={`px-3 py-2 text-sm ${metric === "median" ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink-soft"}`}
            >
              Median resolution
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={metric === "gap"}
              onClick={() => setMetric("gap")}
              className={`px-3 py-2 text-sm ${metric === "gap" ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink-soft"}`}
            >
              Gap vs anchor
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Anchor
          </span>
          <div
            role="tablist"
            aria-label="Equity anchor mode"
            className="inline-flex overflow-hidden rounded-md border border-ink-grid"
          >
            <button
              type="button"
              role="tab"
              aria-selected={anchorMode === "q4"}
              onClick={() => setAnchorMode("q4")}
              className={`px-3 py-2 text-sm ${anchorMode === "q4" ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink-soft"}`}
              title="Compare each cell to its borough's Q4 (highest-income) cell. Boroughs without a Q4 anchor of n>=100 fall out of the gap view."
            >
              Highest-income areas (Q4)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={anchorMode === "city"}
              onClick={() => setAnchorMode("city")}
              className={`px-3 py-2 text-sm ${anchorMode === "city" ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink-soft"}`}
              title="Compare each cell to the citywide median for the same operational category. Use as a fallback when Q4 is missing."
            >
              Citywide median (fallback)
            </button>
          </div>
        </div>
      </div>

      {category === "(All)" && effectiveCategory && (
        <div className="rounded-md border border-state-stable/40 bg-[#E2F1F9] px-3 py-2 text-xs text-[#013a5b]">
          No category selected — defaulting to highest equity-z:{" "}
          <strong>{prettyCategory(effectiveCategory)}</strong>
          {equityZForChosen !== null && (
            <>
              {" "}
              (equity risk score{" "}
              <strong
                title="How far this category's income-based service gap sits from the citywide average, in standard deviations. Higher = more unequal."
              >
                {equityZForChosen.toFixed(2)}
              </strong>
              )
            </>
          )}
          . This default surfaces the largest equity signal first rather than
          the highest-volume category.{" "}
          <button
            type="button"
            onClick={() => setCategory(effectiveCategory)}
            className="underline"
          >
            Lock this selection
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card
          title={`Heatmap — ${effectiveCategory ? prettyCategory(effectiveCategory) : "—"}`}
          subtitle={
            metric === "median"
              ? "Cell colour = median resolution minutes"
              : `Cell colour = % gap vs ${anchorLabel.toLowerCase()}`
          }
          className="lg:col-span-3"
        >
          <EquityHeatmap
            rows={visibleRows}
            allRows={rows}
            metric={metric}
            anchorMode={anchorMode}
          />
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card
            title="Largest equity gap"
            subtitle={`Q1 vs ${anchorLabel}, current category`}
          >
            {callouts.worst ? (
              <div className="space-y-2 text-sm">
                {(() => {
                  const thinAnchor =
                    anchorMode === "q4" &&
                    callouts.worst.q4_anchor_count !== null &&
                    callouts.worst.closed_request_count >=
                      callouts.worst.q4_anchor_count * 10;
                  return (
                    thinAnchor && (
                      <div className="rounded-sm bg-[#FCEBC9] px-2 py-1 text-[11px] text-[#7a5400]">
                        Thin anchor — the highest-income comparison group
                        here is &gt;=10x smaller than the lowest-income
                        group, so the gap below is sensitive to a handful of
                        ZIPs. Switch to Citywide median anchor to cross-check.
                      </div>
                    )
                  );
                })()}
                <div>
                  <span className="text-ink-muted">Borough:</span>{" "}
                  <strong>{callouts.worst.borough}</strong>
                </div>
                <div>
                  Lowest-income areas wait{" "}
                  <strong className="text-state-critical">
                    {fmtSignedPctOrMultiple(callouts.worst[gapKey])}
                  </strong>{" "}
                  longer than {anchorMode === "q4" ? "the highest-income areas" : "the city median"}
                  {isExtremePct(callouts.worst[gapKey]) && (
                    <span className="ml-1 text-[11px] text-ink-muted">
                      (extreme — treat as a data-quality flag, not a precise
                      estimate)
                    </span>
                  )}
                </div>
                <div>
                  Q1 median:{" "}
                  <strong>
                    {fmtMinutes(callouts.worst.median_resolution_minutes)}
                  </strong>{" "}
                  · {anchorMode === "q4" ? "Q4 anchor" : "City median"}:{" "}
                  <strong>
                    {fmtMinutes(
                      anchorMode === "q4"
                        ? callouts.worst.q4_median
                        : callouts.worst.city_median_resolution,
                    )}
                  </strong>
                </div>
                <div className="text-[11px] text-ink-muted">
                  Q1 n = {fmtCount(callouts.worst.closed_request_count)}
                  {anchorMode === "q4" && (
                    <>
                      {" · "}Q4 anchor n ={" "}
                      {callouts.worst.q4_anchor_count !== null
                        ? fmtCount(callouts.worst.q4_anchor_count)
                        : "—"}
                    </>
                  )}
                  {" · "}
                  {callouts.worst.confidence_label}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                No reliable Q1 cells available for this category, anchor, and
                minimum sample threshold.
              </p>
            )}
          </Card>

          <Card title={`Best-served combo (lowest Q1 vs ${anchorLabel})`}>
            {callouts.best ? (
              <div className="text-sm">
                <strong>{callouts.best.borough}</strong> · Q1 vs{" "}
                {anchorMode === "q4" ? "Q4" : "city median"} gap{" "}
                <strong>{fmtSignedPctOrMultiple(callouts.best[gapKey])}</strong>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No reliable Q1 cells.</p>
            )}
          </Card>

          {anchorMode === "q4" && callouts.missingQ4.length > 0 && (
            <Card
              title="Q4 anchor missing"
              subtitle="No high-income ZIPs above the n=100 threshold"
            >
              <p className="text-sm text-ink">
                The following boroughs have a reliable Q1 cell but no Q4
                anchor for this category, so they drop out of the Q4-anchored
                gap view:
              </p>
              <ul className="mt-2 list-inside list-disc text-sm text-ink-muted">
                {callouts.missingQ4.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-ink-muted">
                Switch the anchor to <strong>City median</strong> to bring
                them back into the comparison. See{" "}
                <code>docs/equity_quartile_audit.md</code> for the audit of
                small-ZIP quartile buckets.
              </p>
            </Card>
          )}

          <Card title="Sample caveat">
            <p className="text-sm text-ink">
              Cells with fewer than <strong>{minSample}</strong> closed records
              are shown grey and excluded from the gap call-outs above. Adjust
              the slider to see the full grid.
            </p>
          </Card>
        </div>
      </div>

      <Card
        title="Sample-size guard"
        subtitle="Closed records per borough × quartile"
      >
        <SampleSizeStrip rows={rows} minSample={minSample} />
      </Card>
    </div>
  );
}
