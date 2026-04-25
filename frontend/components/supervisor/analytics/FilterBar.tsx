"use client";

import type { AnalyticsFilters, AnalyticsOption } from "@/lib/analytics";

type Props = {
  filters: AnalyticsFilters;
  options: {
    departments: AnalyticsOption[];
    categories: AnalyticsOption[];
    buildings: AnalyticsOption[];
    assets: AnalyticsOption[];
  };
  onChange: (patch: Partial<AnalyticsFilters>) => void;
};

export default function FilterBar({ filters, options, onChange }: Props) {
  return (
    <div className="sticky top-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-7">
        <select className="rounded-lg border border-slate-200 px-2 py-2 text-sm" value={filters.period} onChange={(e) => onChange({ period: e.target.value as AnalyticsFilters["period"] })}>
          <option value="today">Today</option>
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
          <option value="custom">Custom</option>
        </select>

        <input
          type="date"
          className="rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:bg-slate-100"
          value={filters.from}
          disabled={filters.period !== "custom"}
          onChange={(e) => onChange({ from: e.target.value })}
        />
        <input
          type="date"
          className="rounded-lg border border-slate-200 px-2 py-2 text-sm disabled:bg-slate-100"
          value={filters.to}
          disabled={filters.period !== "custom"}
          onChange={(e) => onChange({ to: e.target.value })}
        />

        <select className="rounded-lg border border-slate-200 px-2 py-2 text-sm" value={filters.department} onChange={(e) => onChange({ department: e.target.value })}>
          <option value="">All Departments</option>
          {options.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select className="rounded-lg border border-slate-200 px-2 py-2 text-sm" value={filters.category} onChange={(e) => onChange({ category: e.target.value })}>
          <option value="">All Categories</option>
          {options.categories.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select className="rounded-lg border border-slate-200 px-2 py-2 text-sm" value={filters.building} onChange={(e) => onChange({ building: e.target.value })}>
          <option value="">All Buildings</option>
          {options.buildings.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select className="rounded-lg border border-slate-200 px-2 py-2 text-sm" value={filters.asset} onChange={(e) => onChange({ asset: e.target.value })}>
          <option value="">All Assets</option>
          {options.assets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

