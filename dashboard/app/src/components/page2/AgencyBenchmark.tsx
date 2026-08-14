import { useMemo } from "react";
import Card from "@/components/shared/Card";
import FilterBar from "@/components/shared/FilterBar";
import PageHeader from "@/components/shared/PageHeader";
import { agencyBenchmark, kpiHeader } from "@/data";
import { useFilters } from "@/context/FilterContext";
import { fmtMinutes, prettyCategory } from "@/lib/format";
import RankedBarChart from "./RankedBarChart";
import DeviationScatter from "./DeviationScatter";

export default function AgencyBenchmark() {
  const { category, baselineMode, minSample } = useFilters();

  const rows = useMemo(() => {
    return agencyBenchmark.filter((r) => {
      if (category !== "(All)" && r.operational_category !== category)
        return false;
      if (r.closed_request_count < minSample) return false;
      return true;
    });
  }, [category, minSample]);

  const baseline = useMemo(() => {
    if (baselineMode === "City Median") {
      return {
        label: "City median",
        value: kpiHeader.median_resolution_minutes,
      };
    }
    if (category !== "(All)") {
      const match = agencyBenchmark.find(
        (r) => r.operational_category === category,
      );
      if (match) {
        return {
          label: `Category median · ${prettyCategory(category)}`,
          value: match.category_median_resolution,
        };
      }
    }
    return {
      label: "City median (fallback — no category selected)",
      value: kpiHeader.median_resolution_minutes,
    };
  }, [baselineMode, category]);

  const slowest = useMemo(() => {
    const reliable = rows.filter((r) => !r.is_low_sample);
    const pool = reliable.length > 0 ? reliable : rows;
    if (pool.length === 0) return null;
    return [...pool].sort(
      (a, b) => b.median_resolution_minutes - a.median_resolution_minutes,
    )[0];
  }, [rows]);

  const slowestIsDohmh =
    !!slowest && slowest.agency.toUpperCase().startsWith("DOHMH");
  const ribbonText =
    category === "(All)"
      ? "Showing all categories. Pick a category in the filter bar to see workload-normalised ranking."
      : slowest
        ? `In ${prettyCategory(category)}, ${slowest.agency} runs the slowest at ${fmtMinutes(slowest.median_resolution_minutes)} (vs ${fmtMinutes(baseline.value)} ${baseline.label.toLowerCase()})${slowestIsDohmh ? " \u2014 treat as indicative; DOHMH data-quality caveat applies." : "."}`
        : "No agencies meet the minimum sample threshold for the current category.";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Page 2 — Agency Bottleneck Benchmark"
        title="Where resolution drags, controlling for workload"
        description="Workload-normalised resolution times per agency. Pick a category to compare apples-to-apples; the city median is shown for context."
        ribbon={
          <div className="rounded-md border border-state-watch/40 bg-[#FFF8EA] px-3 py-2 text-xs text-[#7a5400]">
            {ribbonText}
          </div>
        }
      />

      <FilterBar
        show={{
          category: true,
          borough: false,
          baselineMode: true,
          minSample: true,
        }}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card
          title="Ranked benchmark"
          subtitle={`Agencies sorted by median resolution · ${rows.length} agencies meet n ≥ ${minSample}`}
          className="lg:col-span-3"
        >
          <RankedBarChart
            rows={rows}
            baselineLabel={baseline.label}
            baselineValue={baseline.value}
          />
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card
            title="Deviation distribution"
            subtitle="Closed volume vs median resolution"
          >
            <DeviationScatter
              rows={rows}
              baselineLabel={baseline.label}
              baselineValue={baseline.value}
            />
          </Card>

          <Card title="Read this with care">
            <ul className="space-y-2 text-sm text-ink">
              <li>
                <strong>Median, never mean.</strong> Resolution times are
                right-skewed; a handful of unresolved cases would distort an
                average. All numbers here are medians.
              </li>
              <li>
                <strong>Workload normalised.</strong> Agencies are compared
                within a category, then ranked across categories using a
                percentile rank (see methodology docs).
              </li>
              <li>
                <strong>DOHMH caveat.</strong> Treat DOHMH resolution numbers
                as indicative only — known data-quality issue from prior
                research.
              </li>
              <li>
                <strong>Low confidence muted.</strong> Bars and bubbles for
                agencies with fewer than {minSample} closed records are shown
                in grey and excluded from the ranking call-out.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
