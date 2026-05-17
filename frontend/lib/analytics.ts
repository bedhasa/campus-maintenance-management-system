import { apiRequest } from "@/lib/api";
import { buildApiUrl } from "@/lib/runtime-config";

export type AnalyticsKpiKey = "total" | "approved" | "rejected" | "completed" | "overdue";
export type AnalyticsPeriod = "today" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

export type AnalyticsOption = { id: number; name: string };
export type AnalyticsKpi = { value: number; percentage: number };
export type AnalyticsDistribution = { name: string; key: string; total: number; percentage: number };
export type AnalyticsPriorityDistribution = {
  name: string;
  key: string;
  total: number;
  count: number;
  percentage: number;
};
export type AnalyticsTrendPoint = {
  date: string;
  total: number;
  approved: number;
  rejected: number;
  completed: number;
  overdue: number;
};
export type AnalyticsBreakdown = {
  id: number | null;
  name: string;
  total: number;
  completed: number;
  approved: number;
  rejected: number;
  overdue: number;
  percentage: number;
};
export type AnalyticsGrowth = {
  category_id: number;
  name: string;
  total: number;
  previous_total: number;
  growth: number;
  growth_percentage: number;
  percentage: number;
};
export type AnalyticsMonthlyPerformancePoint = {
  period_start: string;
  label: string;
  total: number;
  completed: number;
  approved: number;
  rejected: number;
  overdue: number;
  completion_rate: number;
  approval_rate: number;
  on_time_completion_rate: number;
  average_resolution_time_hours: number;
};
export type AnalyticsDimensionTrend = {
  id: number | null;
  name: string | null;
  points: Array<{
    label: string;
    total: number;
    completed: number;
    overdue: number;
  }>;
};
export type AnalyticsReliability = {
  mttr_hours: number;
  mtbf_hours: number;
  downtime_hours: number;
  first_time_fix_rate: number;
  failure_events: number;
};

export type AnalyticsResponse = {
  success: boolean;
  kpis: Record<AnalyticsKpiKey, AnalyticsKpi>;
  trend: AnalyticsTrendPoint[];
  status_distribution: AnalyticsDistribution[];
  priority_distribution: AnalyticsPriorityDistribution[];
  monthly_performance: AnalyticsMonthlyPerformancePoint[];
  by_department: AnalyticsBreakdown[];
  by_category: AnalyticsBreakdown[];
  by_building: AnalyticsBreakdown[];
  by_asset: AnalyticsBreakdown[];
  top_departments: AnalyticsBreakdown[];
  top_assets: AnalyticsBreakdown[];
  category_growth: AnalyticsGrowth[];
  performance: {
    completion_rate: number;
    overdue_rate: number;
    approval_rate: number;
    sla_compliance_rate: number;
    on_time_completion_rate: number;
    average_resolution_time_hours: number;
    overdue_count: number;
    first_time_fix_rate: number;
  };
  reliability: AnalyticsReliability;
  trend_context: {
    department: AnalyticsDimensionTrend;
    category: AnalyticsDimensionTrend;
    building: AnalyticsDimensionTrend;
    asset: AnalyticsDimensionTrend;
    asset_failure: AnalyticsDimensionTrend;
  };
  insights: {
    department_with_most_issues?: AnalyticsBreakdown | null;
    category_with_most_issues?: AnalyticsBreakdown | null;
    category_increasing_fastest?: AnalyticsGrowth | null;
    most_problematic_building?: AnalyticsBreakdown | null;
    building_with_highest_failure_rate?: (AnalyticsBreakdown & { failure_rate: number }) | null;
    are_we_completing_on_time?: { value: number; label: string };
    current_sla_compliance?: { value: number; label: string };
  };
  filter_options: {
    departments: AnalyticsOption[];
    buildings: AnalyticsOption[];
    categories: AnalyticsOption[];
    assets: AnalyticsOption[];
  };
};

export type AnalyticsFilters = {
  period: AnalyticsPeriod;
  from: string;
  to: string;
  department: string;
  category: string;
  building: string;
  asset: string;
  kpiFilter: AnalyticsKpiKey;
};

export function buildAnalyticsQuery(filters: AnalyticsFilters): string {
  const q = new URLSearchParams();
  q.set("period", filters.period);
  if (filters.period === "custom") {
    if (filters.from) q.set("from", filters.from);
    if (filters.to) q.set("to", filters.to);
  }
  if (filters.department) q.set("department", filters.department);
  if (filters.category) q.set("category", filters.category);
  if (filters.building) q.set("building", filters.building);
  if (filters.asset) q.set("asset", filters.asset);
  q.set("kpi_filter", filters.kpiFilter);
  return q.toString();
}

export async function fetchAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
  const query = buildAnalyticsQuery(filters);
  return apiRequest<AnalyticsResponse>(`/api/analytics?${query}`, { method: "GET" }, true);
}

export async function exportAnalytics(filters: AnalyticsFilters, format: "excel" | "pdf"): Promise<void> {
  const query = buildAnalyticsQuery(filters);
  const token = typeof window !== "undefined" ? sessionStorage.getItem("auth_token") : null;

  const response = await fetch(buildApiUrl(`/api/analytics/export?${query}&export=${format}`), {
    method: "GET",
    headers: {
      Accept: "application/json,text/csv,*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error("Failed to export analytics.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/csv")) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics-export.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const payload = await response.json();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "analytics-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
