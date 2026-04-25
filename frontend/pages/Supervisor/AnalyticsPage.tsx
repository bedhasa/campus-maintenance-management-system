"use client";

import { useEffect, useMemo, useState } from "react";
import PageSkeleton from "@/components/PageSkeleton";
import AnalyticsTabs, { type AnalyticsTab } from "@/components/supervisor/analytics/AnalyticsTabs";
import DonutChart from "@/components/supervisor/analytics/DonutChart";
import FilterBar from "@/components/supervisor/analytics/FilterBar";
import KpiCard from "@/components/supervisor/analytics/KpiCard";
import SimpleBarChart from "@/components/supervisor/analytics/SimpleBarChart";
import TrendLineChart from "@/components/supervisor/analytics/TrendLineChart";
import {
  exportAnalytics,
  fetchAnalytics,
  type AnalyticsBreakdown,
  type AnalyticsFilters,
  type AnalyticsKpiKey,
  type AnalyticsResponse,
} from "@/lib/analytics";

type ViewMode = "number" | "percentage";
type DepartmentMode = "total" | "overdue" | "completed";

const initialFilters: AnalyticsFilters = {
  period: "monthly",
  from: "",
  to: "",
  department: "",
  category: "",
  building: "",
  asset: "",
  kpiFilter: "total",
};

export default function AnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>(initialFilters);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("overview");
  const [viewMode, setViewMode] = useState<ViewMode>("number");
  const [departmentMode, setDepartmentMode] = useState<DepartmentMode>("total");

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handlePatchFilters = (patch: Partial<AnalyticsFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAnalytics(filters);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filters]);

  const exportCurrentView = async (format: "excel" | "pdf") => {
    setIsExporting(true);
    setError(null);
    try {
      await exportAnalytics(filters, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const valueOfBreakdown = (row: AnalyticsBreakdown) => {
    if (departmentMode === "overdue") return row.overdue;
    if (departmentMode === "completed") return row.completed;
    return row.total;
  };

  const maxDeptValue = useMemo(
    () => Math.max(1, ...(data?.by_department.map(valueOfBreakdown) ?? [1])),
    [data, departmentMode]
  );

  const departmentPercentage = (row: AnalyticsBreakdown) => {
    if (!data) return 0;
    if (departmentMode === "total") return row.percentage;
    if (departmentMode === "overdue") {
      const base = data.kpis.overdue.value || 1;
      return Number(((row.overdue / base) * 100).toFixed(2));
    }
    const base = data.kpis.completed.value || 1;
    return Number(((row.completed / base) * 100).toFixed(2));
  };

  if (loading && !data) {
    return <PageSkeleton cards={3} rows={8} />;
  }

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Supervisor Analytics</h1>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Structured operational intelligence for maintenance decisions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isExporting}
            onClick={() => void exportCurrentView("pdf")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-60"
          >
            Export PDF
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => void exportCurrentView("excel")}
            className="rounded-xl bg-[#003366] px-4 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-60"
          >
            Export Excel
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}

      {data && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {([
            ["total", "Total Requests"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
            ["completed", "Completed"],
            ["overdue", "Overdue"],
          ] as Array<[AnalyticsKpiKey, string]>).map(([key, label]) => (
            <KpiCard
              key={key}
              label={label}
              value={data.kpis[key].value}
              percentage={data.kpis[key].percentage}
              active={filters.kpiFilter === key}
              onClick={() => handlePatchFilters({ kpiFilter: key })}
            />
          ))}
        </div>
      )}

      <FilterBar
        filters={filters}
        options={{
          departments: data?.filter_options.departments ?? [],
          categories: data?.filter_options.categories ?? [],
          buildings: data?.filter_options.buildings ?? [],
          assets: data?.filter_options.assets ?? [],
        }}
        onChange={handlePatchFilters}
      />

      <div className="flex flex-wrap items-center gap-2">
        <AnalyticsTabs value={activeTab} onChange={setActiveTab} />
        <div className="ml-auto flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("number")}
            className={`rounded-lg px-3 py-1 text-xs font-black ${viewMode === "number" ? "bg-slate-900 text-white" : "text-slate-600"}`}
          >
            Quantity
          </button>
          <button
            type="button"
            onClick={() => setViewMode("percentage")}
            className={`rounded-lg px-3 py-1 text-xs font-black ${viewMode === "percentage" ? "bg-slate-900 text-white" : "text-slate-600"}`}
          >
            Percentage
          </button>
        </div>
      </div>

      {data && activeTab === "overview" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <TrendLineChart
            title="Requests Trend Over Time"
            points={data.trend.map((t) => ({ label: t.date, value: t.total }))}
          />
          <DonutChart title="Status Distribution" slices={data.status_distribution} mode={viewMode} />
          <div className="grid gap-3 md:grid-cols-2 xl:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Completion Rate</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{data.performance.completion_rate}%</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Overdue Rate</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{data.performance.overdue_rate}%</p>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-2">
            <p className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">Supervisor Answers</p>
            <div className="grid gap-2 md:grid-cols-2">
              <p className="text-sm font-semibold text-slate-700">
                Which department has most issues:
                <span className="ml-1 font-black">{data.insights.department_with_most_issues?.name ?? "-"}</span>
              </p>
              <p className="text-sm font-semibold text-slate-700">
                Which category is increasing:
                <span className="ml-1 font-black">{data.insights.category_increasing_fastest?.name ?? "No increase detected"}</span>
              </p>
              <p className="text-sm font-semibold text-slate-700">
                Which building is problematic:
                <span className="ml-1 font-black">{data.insights.most_problematic_building?.name ?? "-"}</span>
              </p>
              <p className="text-sm font-semibold text-slate-700">
                Are we completing on time:
                <span className="ml-1 font-black">{data.performance.on_time_completion_rate}%</span>
              </p>
              <p className="text-sm font-semibold text-slate-700">
                How many overdue:
                <span className="ml-1 font-black">{data.performance.overdue_count}</span>
              </p>
              <p className="text-sm font-semibold text-slate-700">
                What is approval rate:
                <span className="ml-1 font-black">{data.performance.approval_rate}%</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {data && activeTab === "departments" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black uppercase tracking-wider text-slate-700">Department Mode</p>
            <div className="flex rounded-xl border border-slate-200 bg-white p-1">
              {(["total", "overdue", "completed"] as DepartmentMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDepartmentMode(mode)}
                  className={`rounded-lg px-3 py-1 text-xs font-black uppercase tracking-wider ${
                    departmentMode === mode ? "bg-slate-900 text-white" : "text-slate-600"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <SimpleBarChart
            title="Requests by Department"
            max={maxDeptValue}
            valueFormatter={(v) => (viewMode === "number" ? String(v) : `${v}%`)}
            items={data.by_department.map((d) => ({
              name: d.name,
              value: viewMode === "number" ? valueOfBreakdown(d) : departmentPercentage(d),
              subtitle: `Total ${d.total} | Overdue ${d.overdue} | Completed ${d.completed}`,
            }))}
          />

          <SimpleBarChart
            title="Top 5 Departments"
            items={data.top_departments.map((d) => ({
              name: d.name,
              value: viewMode === "number" ? d.total : d.percentage,
            }))}
            valueFormatter={(v) => (viewMode === "number" ? String(v) : `${v}%`)}
          />
        </div>
      )}

      {data && activeTab === "categories" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <SimpleBarChart
            title="Requests by Category"
            items={data.by_category.map((c) => ({
              name: c.name,
              value: viewMode === "number" ? c.total : c.percentage,
              subtitle: `Approved ${c.approved} | Rejected ${c.rejected} | Completed ${c.completed}`,
            }))}
            valueFormatter={(v) => (viewMode === "number" ? String(v) : `${v}%`)}
          />
          <SimpleBarChart
            title="Category Growth"
            items={data.category_growth.map((c) => ({
              name: c.name,
              value: c.growth,
              subtitle: `Current ${c.total} | Previous ${c.previous_total} | ${c.growth_percentage}%`,
            }))}
            valueFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
          />
        </div>
      )}

      {data && activeTab === "buildings_assets" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <SimpleBarChart
            title="Requests by Building"
            items={data.by_building.map((b) => ({
              name: b.name,
              value: viewMode === "number" ? b.total : b.percentage,
              subtitle: `Overdue ${b.overdue} | Completed ${b.completed}`,
            }))}
            valueFormatter={(v) => (viewMode === "number" ? String(v) : `${v}%`)}
          />
          <SimpleBarChart
            title="Top 10 Assets with Most Issues"
            items={data.top_assets.map((a) => ({
              name: a.name,
              value: viewMode === "number" ? a.total : a.percentage,
              subtitle: `Overdue ${a.overdue} | Completed ${a.completed}`,
            }))}
            valueFormatter={(v) => (viewMode === "number" ? String(v) : `${v}%`)}
          />
        </div>
      )}

      {data && activeTab === "performance" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Completion Rate %", value: `${data.performance.completion_rate}%` },
            { label: "Overdue %", value: `${data.performance.overdue_rate}%` },
            { label: "Average Resolution Time", value: `${data.performance.average_resolution_time_hours} hrs` },
            { label: "SLA Compliance %", value: `${data.performance.sla_compliance_rate}%` },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{m.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{m.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
