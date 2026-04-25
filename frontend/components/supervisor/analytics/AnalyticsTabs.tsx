"use client";

export type AnalyticsTab = "overview" | "departments" | "categories" | "buildings_assets" | "performance";

type Props = {
  value: AnalyticsTab;
  onChange: (value: AnalyticsTab) => void;
};

const tabs: Array<{ value: AnalyticsTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "departments", label: "Departments" },
  { value: "categories", label: "Categories" },
  { value: "buildings_assets", label: "Buildings & Assets" },
  { value: "performance", label: "Performance" },
];

export default function AnalyticsTabs({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider ${
            value === tab.value ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

