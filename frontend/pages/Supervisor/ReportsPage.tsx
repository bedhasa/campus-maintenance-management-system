"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { apiRequest, readAuthUser } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import {
  buildAnalyticsQuery,
  fetchAnalytics,
  type AnalyticsBreakdown,
  type AnalyticsFilters,
  type AnalyticsMonthlyPerformancePoint,
  type AnalyticsResponse,
} from "@/lib/analytics";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers3,
  PieChart,
  Settings2,
  TrendingUp,
  Wrench,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ReportType =
  | "maintenance_summary"
  | "category_analysis"
  | "building_location"
  | "asset_reliability"
  | "spare_parts_usage"
  | "department_analysis"
  | "technician_performance"
  | "preventive_maintenance";

type BaseReportSummary<T> = {
  from: string;
  to: string;
  report_type: string;
  total_requests: number;
  completed_percent: number;
  overdue_percent: number;
  top_departments: Array<{ name: string; total: number }>;
  spare_part_total_cost: number;
  average_resolution_time_hours: number;
  priority_distribution: Array<{ name: string; total: number; percentage: number }>;
  monthly_performance: AnalyticsMonthlyPerformancePoint[];
  reliability_metrics: {
    mttr_hours: number;
    mtbf_hours: number;
    downtime_hours: number;
    first_time_fix_rate: number;
    failure_events: number;
  };
  report_payload: T;
};

type ReportResponse<T> = {
  success: boolean;
  summary: BaseReportSummary<T>;
  copy_summary?: string;
};

type CategoryPayload = {
  purpose: string;
  categories: Array<AnalyticsBreakdown & { cost: number }>;
  trend: { id: number | null; name: string | null; points: Array<{ label: string; total: number; completed?: number; overdue?: number }> };
  top_category?: (AnalyticsBreakdown & { cost: number }) | null;
};

type BuildingPayload = {
  purpose: string;
  buildings: Array<AnalyticsBreakdown & { cost: number }>;
  trend: { id: number | null; name: string | null; points: Array<{ label: string; total: number; completed?: number; overdue?: number }> };
  top_building?: (AnalyticsBreakdown & { cost: number }) | null;
};

type AssetPayload = {
  purpose: string;
  asset_profiles: Array<{
    asset_id: number;
    asset_name: string;
    brand: string;
    serial_number: string;
    installation_date: string;
    building: string;
    repair_history_count: number;
    current_condition: string;
    replacement_signal: string;
    average_resolution_time_hours: number;
  }>;
};

type SparePartsPayload = {
  purpose: string;
  consumption_log: Array<{
    issue_date: string;
    work_order_id: number;
    part_name: string;
    part_code: string;
    department: string;
    building: string;
    quantity_issued: number;
    quantity_installed: number;
    waste_quantity: number;
    unit_cost: number;
    total_cost: number;
  }>;
  total_cost: number;
  spend_by_department: Array<{ department: string; total_cost: number }>;
  spend_by_building: Array<{ building: string; total_cost: number }>;
  low_stock_alerts: Array<{ id: number; name: string; part_code: string; quantity_available: number; reorder_point: number }>;
  waste_tracking: { issued_quantity: number; installed_quantity: number; waste_quantity: number };
  summary_metrics: { records: number; average_cost_per_issue: number };
};

type DepartmentPayload = {
  purpose: string;
  departments: Array<AnalyticsBreakdown & { top_category: string; top_asset: string; top_spare_part: string; total_cost: number }>;
  top_department?: (AnalyticsBreakdown & { top_category: string; top_asset: string; top_spare_part: string; total_cost: number }) | null;
};

type TechnicianPayload = {
  purpose: string;
  ranked_technicians: Array<{
    technician_name: string;
    specialization: string;
    assigned_volume: number;
    completed_volume: number;
    resolution_rate: number;
    average_duration_hours: number;
    average_duration_days: number;
    pending_load: number;
  }>;
  summary_metrics: { technician_count: number; average_resolution_rate: number; average_pending_load: number };
};

type PreventivePayload = {
  purpose: string;
  summary_metrics: { scheduled_pm: number; completed_pm: number; overdue_pm: number; compliance_rate: number };
  pm_tasks: Array<{
    id: number;
    title: string;
    asset: string;
    building: string;
    category: string;
    priority: string;
    frequency: string;
    scheduled_date: string;
    technician: string;
    status: string;
  }>;
};

type MaintenancePayload = {
  purpose: string;
  request_volume: {
    received: number;
    completed: number;
    completion_rate: number;
    emergency_count: number;
    normal_count: number;
  };
  status_counts: Array<{ status: string; count: number; percentage: number }>;
  location_highlights: {
    departments: Array<{ name: string; count: number; percentage: number }>;
    buildings: Array<{ name: string; count: number; percentage: number }>;
  };
};

type TableColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
  exportValue?: (row: T) => string | number;
};

const reportOptions: Array<{ value: ReportType; label: string; helper: string; icon: ReactNode }> = [
  { value: "maintenance_summary", label: "Maintenance Summary", helper: "Default overall report with KPIs, charts, and issue drivers.", icon: <BarChart3 size={16} /> },
  { value: "category_analysis", label: "Category Analysis", helper: "Understand the issue types happening most often.", icon: <Layers3 size={16} /> },
  { value: "building_location", label: "Building & Location", helper: "See where problems happen across campus.", icon: <Building2 size={16} /> },
  { value: "asset_reliability", label: "Asset Reliability", helper: "Track equipment failures, condition, and repair pressure.", icon: <Settings2 size={16} /> },
  { value: "spare_parts_usage", label: "Spare Parts Usage", helper: "Review part usage, waste, stock pressure, and cost.", icon: <Wrench size={16} /> },
  { value: "department_analysis", label: "Department Report", helper: "Rank departments by requests, top issue source, and spend.", icon: <Filter size={16} /> },
  { value: "technician_performance", label: "Technician Performance", helper: "Measure workload, completion, and pending load.", icon: <TrendingUp size={16} /> },
  { value: "preventive_maintenance", label: "Preventive Maintenance", helper: "Monitor PM schedules, overdue tasks, and compliance.", icon: <CalendarClock size={16} /> },
];

const reportFilterMap: Record<ReportType, Array<"department" | "building" | "category" | "asset">> = {
  maintenance_summary: ["department", "building", "category", "asset"],
  category_analysis: ["department", "building", "category"],
  building_location: ["department", "building", "category"],
  asset_reliability: ["building", "category", "asset"],
  spare_parts_usage: ["department", "building", "asset"],
  department_analysis: ["department", "building", "category"],
  technician_performance: ["department", "building", "category", "asset"],
  preventive_maintenance: ["building", "category", "asset"],
};

const chartPalette = ["#003366", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#64748b"];

const DonutChart = dynamic(() => import("@/components/supervisor/analytics/DonutChart"), {
  ssr: false,
  loading: () => <div className="h-[320px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />,
});

const TrendLineChart = dynamic(() => import("@/components/supervisor/analytics/TrendLineChart"), {
  ssr: false,
  loading: () => <div className="h-[320px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />,
});

export default function SupervisorReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("maintenance_summary");
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: "monthly",
    from: "",
    to: "",
    department: "",
    category: "",
    building: "",
    asset: "",
    kpiFilter: "total",
  });
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [report, setReport] = useState<ReportResponse<unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportOwner, setReportOwner] = useState("System Admin");

  const activeReportMeta = reportOptions.find((item) => item.value === reportType) ?? reportOptions[0];
  const activeFilterKeys = reportFilterMap[reportType];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildAnalyticsQuery(filters);
      const [analyticsRes, reportRes] = await Promise.all([
        fetchAnalytics(filters),
        apiRequest<ReportResponse<unknown>>(`/api/supervisor/reports?${query}&report_type=${reportType}`, { method: "GET" }, true),
      ]);
      setAnalytics(analyticsRes);
      setReport(reportRes);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }, [filters, reportType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const authUser = readAuthUser<{
      name?: string;
      fname?: string;
      lname?: string;
      firstName?: string;
      lastName?: string;
    }>();
    const fullName =
      authUser?.name ||
      [authUser?.fname ?? authUser?.firstName ?? "", authUser?.lname ?? authUser?.lastName ?? ""]
        .join(" ")
        .trim();
    if (fullName) {
      setReportOwner(fullName);
    }
  }, []);

  const summary = report?.summary ?? null;
  const maintenancePayload = summary?.report_payload as MaintenancePayload | undefined;
  const categoryPayload = summary?.report_payload as CategoryPayload | undefined;
  const buildingPayload = summary?.report_payload as BuildingPayload | undefined;
  const assetPayload = summary?.report_payload as AssetPayload | undefined;
  const sparePayload = summary?.report_payload as SparePartsPayload | undefined;
  const departmentPayload = summary?.report_payload as DepartmentPayload | undefined;
  const technicianPayload = summary?.report_payload as TechnicianPayload | undefined;
  const preventivePayload = summary?.report_payload as PreventivePayload | undefined;

  const statusSlices = useMemo(
    () =>
      reportType === "maintenance_summary"
        ? (maintenancePayload?.status_counts ?? []).map((row) => ({
            name: humanizeKey(row.status),
            total: row.count,
            percentage: row.percentage,
          }))
        : (analytics?.status_distribution ?? []).map((row) => ({
            name: row.name,
            total: row.total,
            percentage: row.percentage,
          })),
    [analytics?.status_distribution, maintenancePayload?.status_counts, reportType]
  );

  const trendPoints = useMemo(() => {
    if (reportType === "category_analysis" && categoryPayload?.trend?.points?.length) {
      return categoryPayload.trend.points.map((row) => ({ label: row.label, value: row.total }));
    }
    if (reportType === "building_location" && buildingPayload?.trend?.points?.length) {
      return buildingPayload.trend.points.map((row) => ({ label: row.label, value: row.total }));
    }
    return (summary?.monthly_performance ?? []).map((row) => ({ label: row.label, value: row.total }));
  }, [buildingPayload?.trend?.points, categoryPayload?.trend?.points, reportType, summary?.monthly_performance]);

  const maintenanceBreakdownRows = useMemo(() => {
    const categories = (analytics?.by_category ?? []).slice(0, 4).map((row) => ({ dimension: "Category", ...row }));
    const buildings = (analytics?.by_building ?? []).slice(0, 4).map((row) => ({ dimension: "Building", ...row }));
    const assets = (analytics?.by_asset ?? []).slice(0, 4).map((row) => ({ dimension: "Asset", ...row }));
    return [...categories, ...buildings, ...assets];
  }, [analytics?.by_asset, analytics?.by_building, analytics?.by_category]);

  const spareUsageSlices = useMemo(() => {
    const grouped = (sparePayload?.consumption_log ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.part_name] = (acc[row.part_name] ?? 0) + row.quantity_issued;
      return acc;
    }, {});
    const total = Object.values(grouped).reduce((sum, value) => sum + value, 0);
    return Object.entries(grouped)
      .map(([name, qty]) => ({
        name,
        total: qty,
        percentage: total > 0 ? Number(((qty / total) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [sparePayload?.consumption_log]);

  const pmStatusSlices = useMemo(() => {
    const tasks = preventivePayload?.pm_tasks ?? [];
    const counts = ["scheduled", "completed", "overdue"].map((status) => {
      const total = tasks.filter((row) => row.status === status).length;
      return {
        name: humanizeKey(status),
        total,
        percentage: tasks.length > 0 ? Number(((total / tasks.length) * 100).toFixed(2)) : 0,
      };
    });
    return counts.filter((row) => row.total > 0 || tasks.length === 0);
  }, [preventivePayload?.pm_tasks]);

  const technicianSlices = useMemo(() => {
    const rows = (technicianPayload?.ranked_technicians ?? []).slice(0, 6);
    const total = rows.reduce((sum, row) => sum + row.assigned_volume, 0);
    return rows.map((row) => ({
      name: row.technician_name,
      total: row.assigned_volume,
      percentage: total > 0 ? Number(((row.assigned_volume / total) * 100).toFixed(2)) : 0,
    }));
  }, [technicianPayload?.ranked_technicians]);

  const kpis = useMemo(() => {
    if (!summary) return [];

    if (reportType === "technician_performance") {
      return [
        { label: "Technicians", value: technicianPayload?.summary_metrics?.technician_count ?? 0, accent: "bg-sky-50 text-sky-800" },
        { label: "Avg Completion Rate", value: `${formatPercent(technicianPayload?.summary_metrics?.average_resolution_rate ?? 0)}%`, accent: "bg-emerald-50 text-emerald-800" },
        { label: "Avg Pending Load", value: technicianPayload?.summary_metrics?.average_pending_load ?? 0, accent: "bg-amber-50 text-amber-800" },
        { label: "Avg Resolution Time", value: `${formatNumber(summary.average_resolution_time_hours)} hrs`, accent: "bg-slate-100 text-slate-800" },
      ];
    }

    if (reportType === "spare_parts_usage") {
      return [
        { label: "Part Records", value: sparePayload?.summary_metrics?.records ?? 0, accent: "bg-sky-50 text-sky-800" },
        { label: "Total Cost", value: formatMoney(sparePayload?.total_cost ?? 0), accent: "bg-emerald-50 text-emerald-800" },
        { label: "Waste Quantity", value: sparePayload?.waste_tracking?.waste_quantity ?? 0, accent: "bg-rose-50 text-rose-800" },
        { label: "Avg Cost / Issue", value: formatMoney(sparePayload?.summary_metrics?.average_cost_per_issue ?? 0), accent: "bg-slate-100 text-slate-800" },
      ];
    }

    if (reportType === "asset_reliability") {
      const topAsset = assetPayload?.asset_profiles?.[0];
      return [
        { label: "Failure Events", value: summary.reliability_metrics.failure_events, accent: "bg-rose-50 text-rose-800" },
        { label: "MTTR", value: `${formatNumber(summary.reliability_metrics.mttr_hours)} hrs`, accent: "bg-sky-50 text-sky-800" },
        { label: "MTBF", value: `${formatNumber(summary.reliability_metrics.mtbf_hours)} hrs`, accent: "bg-emerald-50 text-emerald-800" },
        { label: "Top Failing Asset", value: topAsset?.asset_name ?? "N/A", accent: "bg-slate-100 text-slate-800" },
      ];
    }

    if (reportType === "preventive_maintenance") {
      return [
        { label: "Scheduled PM", value: preventivePayload?.summary_metrics?.scheduled_pm ?? 0, accent: "bg-sky-50 text-sky-800" },
        { label: "Completed PM", value: preventivePayload?.summary_metrics?.completed_pm ?? 0, accent: "bg-emerald-50 text-emerald-800" },
        { label: "Overdue PM", value: preventivePayload?.summary_metrics?.overdue_pm ?? 0, accent: "bg-rose-50 text-rose-800" },
        { label: "Compliance", value: `${formatPercent(preventivePayload?.summary_metrics?.compliance_rate ?? 0)}%`, accent: "bg-slate-100 text-slate-800" },
      ];
    }

    return [
      { label: "Total Requests", value: summary.total_requests, accent: "bg-sky-50 text-sky-800" },
      { label: "Completion Rate", value: `${formatPercent(summary.completed_percent)}%`, accent: "bg-emerald-50 text-emerald-800" },
      { label: "Overdue Rate", value: `${formatPercent(summary.overdue_percent)}%`, accent: "bg-rose-50 text-rose-800" },
      { label: "Spare Part Cost", value: formatMoney(summary.spare_part_total_cost), accent: "bg-slate-100 text-slate-800" },
    ];
  }, [
    assetPayload?.asset_profiles,
    preventivePayload?.summary_metrics,
    reportType,
    sparePayload?.summary_metrics,
    sparePayload?.total_cost,
    sparePayload?.waste_tracking?.waste_quantity,
    summary,
    technicianPayload?.summary_metrics,
  ]);

  const pendingCount = analytics?.status_distribution?.find((s) => s.key === "submitted")?.total ?? 0;
  const inProgressCount = analytics?.status_distribution?.find((s) => s.key === "in_progress")?.total ?? 0;
  const completedCount =
    (analytics?.status_distribution?.find((s) => s.key === "completed")?.total ?? 0) +
    (analytics?.status_distribution?.find((s) => s.key === "closed")?.total ?? 0);
  const delayedCount = Math.round(((summary?.overdue_percent ?? 0) / 100) * (summary?.total_requests ?? 0));

  const currentPdfTable = useMemo(() => {
    if (!summary) return { title: "Report Data", columns: ["Label", "Value"], rows: [] as Array<Array<string | number>> };

    if (reportType === "category_analysis") {
      return {
        title: "Category Analysis",
        columns: ["Category", "Requests", "Share %", "Completed", "Overdue", "Cost"],
        rows: (categoryPayload?.categories ?? []).map((row) => [row.name, row.total, row.percentage, row.completed, row.overdue, formatMoney(row.cost)]),
      };
    }
    if (reportType === "building_location") {
      return {
        title: "Building Report",
        columns: ["Building", "Requests", "Share %", "Completed", "Overdue", "Cost"],
        rows: (buildingPayload?.buildings ?? []).map((row) => [row.name, row.total, row.percentage, row.completed, row.overdue, formatMoney(row.cost)]),
      };
    }
    if (reportType === "asset_reliability") {
      return {
        title: "Asset Reliability",
        columns: ["Asset", "Building", "Failures", "Condition", "Signal"],
        rows: (assetPayload?.asset_profiles ?? []).map((row) => [
          row.asset_name,
          row.building,
          row.repair_history_count,
          row.current_condition,
          row.replacement_signal,
        ]),
      };
    }
    if (reportType === "spare_parts_usage") {
      return {
        title: "Spare Parts Usage",
        columns: ["Part", "WO", "Department", "Building", "Issued", "Installed", "Waste", "Cost"],
        rows: (sparePayload?.consumption_log ?? []).map((row) => [
          row.part_name,
          row.work_order_id,
          row.department,
          row.building,
          row.quantity_issued,
          row.quantity_installed,
          row.waste_quantity,
          formatMoney(row.total_cost),
        ]),
      };
    }
    if (reportType === "department_analysis") {
      return {
        title: "Department Report",
        columns: ["Department", "Requests", "Completed", "Top Category", "Top Asset", "Top Spare Part", "Cost"],
        rows: (departmentPayload?.departments ?? []).map((row) => [
          row.name,
          row.total,
          row.completed,
          row.top_category,
          row.top_asset,
          row.top_spare_part,
          formatMoney(row.total_cost),
        ]),
      };
    }
    if (reportType === "technician_performance") {
      return {
        title: "Technician Performance",
        columns: ["Technician", "Specialization", "Assigned", "Completed", "Completion %", "Pending"],
        rows: (technicianPayload?.ranked_technicians ?? []).map((row) => [
          row.technician_name,
          row.specialization,
          row.assigned_volume,
          row.completed_volume,
          row.resolution_rate,
          row.pending_load,
        ]),
      };
    }
    if (reportType === "preventive_maintenance") {
      return {
        title: "Preventive Maintenance",
        columns: ["Task", "Asset", "Building", "Frequency", "Technician", "Scheduled", "Status"],
        rows: (preventivePayload?.pm_tasks ?? []).map((row) => [
          row.title,
          row.asset,
          row.building,
          humanizeKey(row.frequency),
          row.technician,
          formatDate(row.scheduled_date),
          humanizeKey(row.status),
        ]),
      };
    }
    return {
      title: "Maintenance Summary",
      columns: ["Dimension", "Name", "Requests", "Completed", "Overdue", "Share %"],
      rows: maintenanceBreakdownRows.map((row) => [row.dimension, row.name, row.total, row.completed, row.overdue, row.percentage]),
    };
  }, [
    assetPayload?.asset_profiles,
    buildingPayload?.buildings,
    categoryPayload?.categories,
    departmentPayload?.departments,
    maintenanceBreakdownRows,
    preventivePayload?.pm_tasks,
    reportType,
    sparePayload?.consumption_log,
    summary,
    technicianPayload?.ranked_technicians,
  ]);

  const buildPeriodLabel = () => {
    if (filters.period === "custom") return "CUSTOM";
    return String(filters.period || "MONTHLY").toUpperCase();
  };

  const loadImageDataUrl = (src: string) =>
    new Promise<string | null>((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const buildPieChartImage = (rows: Array<{ name: string; total: number }>) => {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const total = rows.reduce((sum, r) => sum + r.total, 0) || 1;
    let start = -Math.PI / 2;
    const centerX = 170;
    const centerY = 140;
    const radius = 90;
    rows.slice(0, 6).forEach((row, idx) => {
      const angle = (row.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = chartPalette[idx % chartPalette.length];
      ctx.fill();
      start += angle;
    });
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px Arial";
    ctx.fillText("Category Distribution", 300, 30);
    ctx.font = "12px Arial";
    rows.slice(0, 5).forEach((row, idx) => {
      ctx.fillStyle = chartPalette[idx % chartPalette.length];
      ctx.fillRect(300, 50 + idx * 24, 12, 12);
      ctx.fillStyle = "#334155";
      ctx.fillText(`${row.name} (${row.total})`, 320, 60 + idx * 24);
    });
    return canvas.toDataURL("image/png");
  };

  const buildLineChartImage = (points: Array<{ label: string; value: number }>) => {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const padding = 42;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;
    const maxVal = Math.max(...points.map((p) => p.value), 1);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + width, y);
      ctx.stroke();
    }
    if (points.length > 0) {
      ctx.strokeStyle = "#003366";
      ctx.lineWidth = 3;
      ctx.beginPath();
      points.forEach((point, idx) => {
        const x = padding + (width / Math.max(points.length - 1, 1)) * idx;
        const y = padding + height - (point.value / maxVal) * height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.fillStyle = "#475569";
    ctx.font = "11px Arial";
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxVal / ySteps) * (ySteps - i));
      const y = padding + (height / ySteps) * i;
      ctx.fillText(String(val), 8, y + 4);
    }
    points.slice(0, 6).forEach((point, idx) => {
      const x = padding + (width / Math.max(points.length - 1, 1)) * idx;
      const shortLabel = point.label.length > 8 ? `${point.label.slice(0, 8)}…` : point.label;
      ctx.fillText(shortLabel, x - 15, padding + height + 16);
    });
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px Arial";
    ctx.fillText("Request Trend", 12, 20);
    ctx.font = "11px Arial";
    ctx.fillStyle = "#334155";
    ctx.fillText("Y: Requests", 12, 34);
    ctx.fillText("X: Date", canvas.width - 70, canvas.height - 8);
    return canvas.toDataURL("image/png");
  };

  const drawPdfHeader = async (doc: jsPDF) => {
    const logo = await loadImageDataUrl("/hu_logo.jpg");
    if (logo) {
      doc.addImage(logo, "PNG", 12, 8, 16, 16);
    }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("HAWASSA UNIVRITY INSTITUT OF TECHNOLOGY", 32, 13);
    doc.setFontSize(10);
    doc.text("HU-IOT CMMS", 32, 18);
    doc.text(
      `DATE TYPE: ${buildPeriodLabel()} | DATA RANGE: ${formatDate(summary?.from)} - ${formatDate(summary?.to)}`,
      32,
      23
    );
    const filterSummary = buildFilterSummary();
    doc.setFontSize(9);
    doc.text(`FILTERS: ${filterSummary}`, 12, 31);
    doc.setDrawColor(203, 213, 225);
    doc.line(12, 34, 198, 34);
  };

  const drawPdfFooter = (doc: jsPDF) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(203, 213, 225);
    doc.line(12, pageHeight - 22, 198, pageHeight - 22);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Downloaded by: ${reportOwner}`, 12, pageHeight - 15);
    doc.text("Signature: ____________________", 140, pageHeight - 15);
  };

  const resolveFilterName = (
    type: "department" | "building" | "category" | "asset",
    value: string
  ) => {
    if (!value) return "All";
    const source =
      type === "department"
        ? analytics?.filter_options.departments
        : type === "building"
        ? analytics?.filter_options.buildings
        : type === "category"
        ? analytics?.filter_options.categories
        : analytics?.filter_options.assets;
    const found = source?.find((row) => String(row.id) === value);
    return found?.name ?? value;
  };

  const buildFilterSummary = () => {
    const parts = [
      `Department: ${resolveFilterName("department", filters.department)}`,
      `Building: ${resolveFilterName("building", filters.building)}`,
      `Category: ${resolveFilterName("category", filters.category)}`,
      `Asset: ${resolveFilterName("asset", filters.asset)}`,
    ];
    return parts.join(" | ");
  };

  const buildBarChartImage = (
    rows: Array<{ name: string; value: number }>,
    title: string,
    color: string
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px Arial";
    ctx.fillText(title, 12, 20);
    const topRows = rows.slice(0, 6);
    const max = Math.max(...topRows.map((row) => row.value), 1);
    topRows.forEach((row, idx) => {
      const y = 42 + idx * 34;
      const width = (row.value / max) * 260;
      ctx.fillStyle = color;
      ctx.fillRect(170, y, width, 18);
      ctx.fillStyle = "#334155";
      ctx.font = "11px Arial";
      ctx.fillText(row.name.length > 22 ? `${row.name.slice(0, 22)}…` : row.name, 12, y + 13);
      ctx.fillText(String(row.value), 438, y + 13);
    });
    return canvas.toDataURL("image/png");
  };

  const buildGroupedChartImage = (
    rows: Array<{ name: string; assigned: number; completed: number }>,
    title: string
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px Arial";
    ctx.fillText(title, 12, 20);
    const topRows = rows.slice(0, 5);
    const max = Math.max(...topRows.map((row) => Math.max(row.assigned, row.completed)), 1);
    topRows.forEach((row, idx) => {
      const y = 52 + idx * 40;
      const assignedWidth = (row.assigned / max) * 180;
      const completedWidth = (row.completed / max) * 180;
      ctx.fillStyle = "#003366";
      ctx.fillRect(150, y, assignedWidth, 10);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(150, y + 14, completedWidth, 10);
      ctx.fillStyle = "#334155";
      ctx.font = "11px Arial";
      ctx.fillText(row.name.length > 18 ? `${row.name.slice(0, 18)}…` : row.name, 12, y + 12);
    });
    return canvas.toDataURL("image/png");
  };

  const downloadCurrentPdf = async () => {
    if (!summary) return;
    const doc = new jsPDF("p", "mm", "a4");
    await drawPdfHeader(doc);
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(activeReportMeta.label, 12, 40);

    autoTable(doc, {
      startY: 44,
      head: [["KPI", "Value"]],
      body:
        reportType === "maintenance_summary"
          ? [
              ["Total Requests", summary.total_requests],
              ["Pending", pendingCount],
              ["In Progress", inProgressCount],
              ["Delayed", delayedCount],
              ["Completed", completedCount],
              ["Completion Rate", `${formatPercent(summary.completed_percent)}%`],
              ["Overdue Rate", `${formatPercent(summary.overdue_percent)}%`],
              ["Spare Cost", formatMoney(summary.spare_part_total_cost)],
            ]
          : kpis.map((item) => [item.label, String(item.value)]),
      theme: "grid",
      headStyles: { fillColor: [0, 51, 102] },
    });

    let cursorY =
      ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 44) + 6;

    if (reportType === "maintenance_summary") {
      const pieRows = (analytics?.by_category ?? []).slice(0, 6).map((r) => ({ name: r.name, total: r.total }));
      const pieImage = buildPieChartImage(pieRows);
      const lineImage = buildLineChartImage(trendPoints);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("Category Distribution (Pie Chart)", 12, cursorY - 2);
      doc.text("Request Trend (Line Graph)", 108, cursorY - 2);
      if (pieImage) doc.addImage(pieImage, "PNG", 12, cursorY, 90, 50);
      if (lineImage) doc.addImage(lineImage, "PNG", 108, cursorY, 90, 50);
      cursorY += 56;

      doc.setFontSize(11);
      doc.text("Top 5 Buildings", 12, cursorY - 1);
      doc.text("Top 5 Departments", 106, cursorY - 1);
      autoTable(doc, {
        startY: cursorY,
        head: [["Building", "Req Count", "Top Category", "Share %", "Top Room"]],
        body: (analytics?.by_building ?? []).slice(0, 5).map((row) => [
          row.name,
          row.total,
          analytics?.by_category?.[0]?.name ?? "N/A",
          `${formatPercent(row.percentage)}%`,
          "N/A",
        ]),
        tableWidth: 92,
        margin: { left: 12 },
        headStyles: { fillColor: [15, 23, 42] },
      });
      autoTable(doc, {
        startY: cursorY,
        head: [["Department", "Req", "Top Category", "Building", "Share"]],
        body: (analytics?.by_department ?? []).slice(0, 5).map((row) => [
          row.name,
          row.total,
          analytics?.by_category?.[0]?.name ?? "N/A",
          analytics?.by_building?.[0]?.name ?? "N/A",
          `${formatPercent(row.percentage)}%`,
        ]),
        tableWidth: 92,
        margin: { left: 106 },
        headStyles: { fillColor: [15, 23, 42] },
      });

      cursorY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? cursorY) + 4;

      const spareReport = await apiRequest<ReportResponse<SparePartsPayload>>(
        `/api/supervisor/reports?${buildAnalyticsQuery(filters)}&report_type=spare_parts_usage`,
        { method: "GET" },
        true
      ).catch(() => null);

      doc.setFontSize(11);
      doc.text("Top Assets", 12, cursorY - 1);
      doc.text("Top Spare Parts", 106, cursorY - 1);
      autoTable(doc, {
        startY: cursorY,
        head: [["Asset", "Requests", "Share"]],
        body: (analytics?.by_asset ?? []).slice(0, 5).map((row) => [row.name, row.total, `${formatPercent(row.percentage)}%`]),
        tableWidth: 92,
        margin: { left: 12 },
        headStyles: { fillColor: [15, 23, 42] },
      });
      autoTable(doc, {
        startY: cursorY,
        head: [["Spare Part", "Usage", "Cost", "Share"]],
        body: (spareReport?.summary?.report_payload?.consumption_log ?? [])
          .slice(0, 5)
          .map((row) => [row.part_name, row.quantity_issued, formatMoney(row.total_cost), "-"]),
        tableWidth: 92,
        margin: { left: 106 },
        headStyles: { fillColor: [15, 23, 42] },
      });
    } else {
      const chartAImage =
        reportType === "category_analysis"
          ? buildPieChartImage((categoryPayload?.categories ?? []).slice(0, 6).map((r) => ({ name: r.name, total: r.total })))
          : reportType === "building_location"
          ? buildPieChartImage((buildingPayload?.buildings ?? []).slice(0, 6).map((r) => ({ name: r.name, total: r.total })))
          : reportType === "asset_reliability"
          ? buildPieChartImage(
              (assetPayload?.asset_profiles ?? []).slice(0, 6).map((r) => ({
                name: r.asset_name,
                total: r.repair_history_count,
              }))
            )
          : reportType === "spare_parts_usage"
          ? buildPieChartImage(spareUsageSlices.map((r) => ({ name: r.name, total: r.total })))
          : reportType === "department_analysis"
          ? buildPieChartImage((departmentPayload?.departments ?? []).slice(0, 6).map((r) => ({ name: r.name, total: r.total })))
          : reportType === "technician_performance"
          ? buildPieChartImage(technicianSlices.map((r) => ({ name: r.name, total: r.total })))
          : buildPieChartImage(pmStatusSlices.map((r) => ({ name: r.name, total: r.total })));

      const chartBImage =
        reportType === "category_analysis"
          ? buildLineChartImage(trendPoints)
          : reportType === "building_location"
          ? buildBarChartImage((buildingPayload?.buildings ?? []).slice(0, 8).map((r) => ({ name: r.name, value: r.total })), "Buildings Ranked by Requests", "#003366")
          : reportType === "asset_reliability"
          ? buildBarChartImage(
              (assetPayload?.asset_profiles ?? []).slice(0, 8).map((r) => ({ name: r.asset_name, value: r.repair_history_count })),
              "Top Problematic Assets",
              "#ef4444"
            )
          : reportType === "spare_parts_usage"
          ? buildBarChartImage(
              (sparePayload?.spend_by_building ?? []).slice(0, 8).map((r) => ({ name: r.building, value: r.total_cost })),
              "Spend by Building",
              "#22c55e"
            )
          : reportType === "department_analysis"
          ? buildBarChartImage(
              (departmentPayload?.departments ?? []).slice(0, 8).map((r) => ({ name: r.name, value: r.total_cost })),
              "Department Cost Pressure",
              "#f59e0b"
            )
          : reportType === "technician_performance"
          ? buildGroupedChartImage(
              (technicianPayload?.ranked_technicians ?? []).slice(0, 8).map((r) => ({
                name: shortenName(r.technician_name),
                assigned: r.assigned_volume,
                completed: r.completed_volume,
              })),
              "Assigned vs Completed"
            )
          : buildBarChartImage(
              countByLabel(preventivePayload?.pm_tasks ?? [], (row) => humanizeKey(row.frequency)),
              "PM Frequency Mix",
              "#003366"
            );

      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("Chart 1", 12, cursorY - 2);
      doc.text("Chart 2", 108, cursorY - 2);
      if (chartAImage) doc.addImage(chartAImage, "PNG", 12, cursorY, 90, 50);
      if (chartBImage) doc.addImage(chartBImage, "PNG", 108, cursorY, 90, 50);
      cursorY += 56;

      doc.setFontSize(11);
      doc.text(currentPdfTable.title, 12, cursorY - 2);
      autoTable(doc, {
        startY: cursorY,
        head: [currentPdfTable.columns],
        body: currentPdfTable.rows,
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 8 },
      });
    }

    drawPdfFooter(doc);
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = [now.getHours(), now.getMinutes(), now.getSeconds()].map((v) => String(v).padStart(2, "0")).join("-");
    doc.save(`cmms-${reportType}-${datePart}_${timePart}.pdf`);
  };

  if (loading && !summary) {
    return <PageSkeleton cards={4} rows={8} />;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Supervisor Reports</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">{activeReportMeta.label}</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">{activeReportMeta.helper}</p>
          </div>
          <button
            type="button"
            onClick={() => void downloadCurrentPdf()}
            disabled={!summary}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003366] px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#0b4480] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileText size={16} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <SelectField label="Report Type" value={reportType} onChange={(value) => setReportType(value as ReportType)}>
            {reportOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <SelectField label="Period" value={filters.period} onChange={(value) => setFilters((prev) => ({ ...prev, period: value as AnalyticsFilters["period"] }))}>
            <option value="today">Today</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
            <option value="custom">Custom</option>
          </SelectField>

          {filters.period === "custom" ? (
            <>
              <InputField label="From" type="date" value={filters.from} onChange={(value) => setFilters((prev) => ({ ...prev, from: value }))} />
              <InputField label="To" type="date" value={filters.to} onChange={(value) => setFilters((prev) => ({ ...prev, to: value }))} />
            </>
          ) : null}

          {activeFilterKeys.includes("department") ? (
            <SelectField label="Department" value={filters.department} onChange={(value) => setFilters((prev) => ({ ...prev, department: value }))}>
              <option value="">All Departments</option>
              {analytics?.filter_options.departments.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </SelectField>
          ) : null}

          {activeFilterKeys.includes("building") ? (
            <SelectField label="Building" value={filters.building} onChange={(value) => setFilters((prev) => ({ ...prev, building: value }))}>
              <option value="">All Buildings</option>
              {analytics?.filter_options.buildings.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </SelectField>
          ) : null}

          {activeFilterKeys.includes("category") ? (
            <SelectField label="Category" value={filters.category} onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}>
              <option value="">All Categories</option>
              {analytics?.filter_options.categories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </SelectField>
          ) : null}

          {activeFilterKeys.includes("asset") ? (
            <SelectField label="Asset" value={filters.asset} onChange={(value) => setFilters((prev) => ({ ...prev, asset: value }))}>
              <option value="">All Assets</option>
              {analytics?.filter_options.assets.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </SelectField>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-700"
          >
            <PieChart size={15} />
            Update Report
          </button>
          <button
            type="button"
            onClick={() =>
              setFilters({
                period: "monthly",
                from: "",
                to: "",
                department: "",
                category: "",
                building: "",
                asset: "",
                kpiFilter: "total",
              })
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
          >
            <Filter size={15} />
            Reset Filters
          </button>
        </div>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <MetricCard key={item.label} label={item.label} value={item.value} accent={item.accent} />
        ))}
      </div>

      {reportType === "maintenance_summary" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <DonutChart title="Status Distribution" slices={statusSlices} mode="number" />
            </div>
            <div className="xl:col-span-7">
              <TrendLineChart title="Request Trend" points={trendPoints} />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-7">
              <ChartCard title="Top Categories">
                <HorizontalBarChart
                  rows={(analytics?.by_category ?? []).slice(0, 6).map((row) => ({ name: row.name, value: row.total }))}
                  color="#003366"
                />
              </ChartCard>
            </div>
            <div className="xl:col-span-5">
              <ChartCard title="Priority Distribution">
                <SimpleLegend rows={(summary?.priority_distribution ?? []).map((row) => ({ label: row.name, value: `${row.total} (${formatPercent(row.percentage)}%)` }))} />
              </ChartCard>
            </div>
          </div>
          <ReportTableCard
            title="Issue Breakdown"
            description="Category, building, and asset drivers in the selected range."
            rows={maintenanceBreakdownRows}
            fileStem="maintenance-breakdown"
            columns={[
              { key: "dimension", label: "Dimension" },
              { key: "name", label: "Name" },
              { key: "total", label: "Requests", align: "right" },
              { key: "completed", label: "Completed", align: "right" },
              { key: "overdue", label: "Overdue", align: "right" },
              { key: "percentage", label: "Share %", align: "right", exportValue: (row) => formatPercent(row.percentage) },
            ]}
          />
        </>
      ) : null}

      {reportType === "category_analysis" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <DonutChart title="Category Distribution" slices={toSlices(categoryPayload?.categories ?? [], "name", "total", "percentage")} mode="number" />
            </div>
            <div className="xl:col-span-7">
              <TrendLineChart title={filters.category ? "Selected Category Trend" : "Category Trend"} points={trendPoints} />
            </div>
          </div>
          <ChartCard title="Top Categories by Request Count">
            <VerticalBarChart rows={(categoryPayload?.categories ?? []).slice(0, 8).map((row) => ({ name: row.name, value: row.total }))} color="#0ea5e9" />
          </ChartCard>
          <ReportTableCard
            title="Category Details"
            description="Count, share, completion, overdue load, and cost by issue category."
            rows={categoryPayload?.categories ?? []}
            fileStem="category-analysis"
            columns={[
              { key: "name", label: "Category" },
              { key: "total", label: "Requests", align: "right" },
              { key: "percentage", label: "Share %", align: "right", exportValue: (row) => formatPercent(row.percentage) },
              { key: "completed", label: "Completed", align: "right" },
              { key: "overdue", label: "Overdue", align: "right" },
              { key: "cost", label: "Cost", align: "right", exportValue: (row) => formatMoney(row.cost) },
            ]}
          />
        </>
      ) : null}

      {reportType === "building_location" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <DonutChart title="Building Distribution" slices={toSlices(buildingPayload?.buildings ?? [], "name", "total", "percentage")} mode="number" />
            </div>
            <div className="xl:col-span-7">
              <ChartCard title="Buildings Ranked by Requests">
                <HorizontalBarChart rows={(buildingPayload?.buildings ?? []).slice(0, 8).map((row) => ({ name: row.name, value: row.total }))} color="#003366" />
              </ChartCard>
            </div>
          </div>
          <ReportTableCard
            title="Building Statistics"
            description="Request load and spare-part spend by building."
            rows={buildingPayload?.buildings ?? []}
            fileStem="building-report"
            columns={[
              { key: "name", label: "Building" },
              { key: "total", label: "Requests", align: "right" },
              { key: "completed", label: "Completed", align: "right" },
              { key: "overdue", label: "Overdue", align: "right" },
              { key: "percentage", label: "Share %", align: "right", exportValue: (row) => formatPercent(row.percentage) },
              { key: "cost", label: "Cost", align: "right", exportValue: (row) => formatMoney(row.cost) },
            ]}
          />
        </>
      ) : null}

      {reportType === "asset_reliability" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <DonutChart
                title="Failure Share"
                slices={toSlices((assetPayload?.asset_profiles ?? []).slice(0, 6), "asset_name", "repair_history_count")}
                mode="number"
              />
            </div>
            <div className="xl:col-span-7">
              <ChartCard title="Top Problematic Assets">
                <HorizontalBarChart
                  rows={(assetPayload?.asset_profiles ?? []).slice(0, 8).map((row) => ({ name: row.asset_name, value: row.repair_history_count }))}
                  color="#ef4444"
                />
              </ChartCard>
            </div>
          </div>
          <ReportTableCard
            title="Asset Reliability Table"
            description="Failure count, condition, replacement signal, and average repair time."
            rows={assetPayload?.asset_profiles ?? []}
            fileStem="asset-reliability"
            columns={[
              { key: "asset_name", label: "Asset" },
              { key: "building", label: "Building" },
              { key: "repair_history_count", label: "Failures", align: "right" },
              { key: "current_condition", label: "Condition" },
              { key: "replacement_signal", label: "Signal" },
            ]}
          />
        </>
      ) : null}

      {reportType === "spare_parts_usage" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <DonutChart title="Most Used Spare Parts" slices={spareUsageSlices} mode="number" />
            </div>
            <div className="xl:col-span-7">
              <ChartCard title="Spend by Building">
                <HorizontalBarChart
                  rows={(sparePayload?.spend_by_building ?? []).slice(0, 8).map((row) => ({ name: row.building, value: row.total_cost }))}
                  color="#22c55e"
                />
              </ChartCard>
            </div>
          </div>
          <ReportTableCard
            title="Consumption Log"
            description="Detailed spare-part issue, installation, waste, and cost records."
            rows={sparePayload?.consumption_log ?? []}
            fileStem="spare-parts-log"
            columns={[
              { key: "issue_date", label: "Issue Date", exportValue: (row) => formatDate(row.issue_date) },
              { key: "part_name", label: "Part" },
              { key: "work_order_id", label: "WO", align: "right" },
              { key: "department", label: "Department" },
              { key: "building", label: "Building" },
              { key: "quantity_issued", label: "Issued", align: "right" },
              { key: "quantity_installed", label: "Installed", align: "right" },
              { key: "waste_quantity", label: "Waste", align: "right" },
              { key: "total_cost", label: "Cost", align: "right", exportValue: (row) => formatMoney(row.total_cost) },
            ]}
          />
          <ReportTableCard
            title="Low Stock Alert"
            description="Parts already at or below their reorder point."
            rows={sparePayload?.low_stock_alerts ?? []}
            fileStem="low-stock-alert"
            columns={[
              { key: "name", label: "Part" },
              { key: "part_code", label: "Code" },
              { key: "quantity_available", label: "Available", align: "right" },
              { key: "reorder_point", label: "Reorder Point", align: "right" },
            ]}
          />
        </>
      ) : null}

      {reportType === "department_analysis" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <DonutChart title="Department Request Share" slices={toSlices(departmentPayload?.departments ?? [], "name", "total", "percentage")} mode="number" />
            </div>
            <div className="xl:col-span-7">
              <ChartCard title="Department Cost Pressure">
                <VerticalBarChart
                  rows={(departmentPayload?.departments ?? []).slice(0, 8).map((row) => ({ name: row.name, value: row.total_cost }))}
                  color="#f59e0b"
                />
              </ChartCard>
            </div>
          </div>
          <ReportTableCard
            title="Department Ranking"
            description="Best single-table view of request volume, top issue source, top asset, top spare part, and spend."
            rows={departmentPayload?.departments ?? []}
            fileStem="department-report"
            columns={[
              { key: "name", label: "Department" },
              { key: "total", label: "Requests", align: "right" },
              { key: "completed", label: "Completed", align: "right" },
              { key: "top_category", label: "Top Category" },
              { key: "top_asset", label: "Top Asset" },
              { key: "top_spare_part", label: "Top Spare Part" },
              { key: "total_cost", label: "Cost", align: "right", exportValue: (row) => formatMoney(row.total_cost) },
            ]}
          />
        </>
      ) : null}

      {reportType === "technician_performance" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <DonutChart title="Workload Share" slices={technicianSlices} mode="number" />
            </div>
            <div className="xl:col-span-7">
              <ChartCard title="Assigned vs Completed">
                <GroupedBarChart
                  rows={(technicianPayload?.ranked_technicians ?? []).slice(0, 8).map((row) => ({
                    name: shortenName(row.technician_name),
                    assigned: row.assigned_volume,
                    completed: row.completed_volume,
                  }))}
                />
              </ChartCard>
            </div>
          </div>
          <ReportTableCard
            title="Technician Performance Table"
            description="Assigned work, completed work, pending load, completion rate, and average duration."
            rows={technicianPayload?.ranked_technicians ?? []}
            fileStem="technician-performance"
            columns={[
              { key: "technician_name", label: "Technician" },
              { key: "specialization", label: "Specialization" },
              { key: "assigned_volume", label: "Assigned", align: "right" },
              { key: "completed_volume", label: "Completed", align: "right" },
              { key: "pending_load", label: "Pending", align: "right" },
              { key: "resolution_rate", label: "Completion %", align: "right", exportValue: (row) => formatPercent(row.resolution_rate) },
            ]}
          />
        </>
      ) : null}

      {reportType === "preventive_maintenance" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <DonutChart title="PM Status Distribution" slices={pmStatusSlices} mode="number" />
            </div>
            <div className="xl:col-span-7">
              <ChartCard title="PM Frequency Mix">
                <VerticalBarChart
                  rows={countByLabel(preventivePayload?.pm_tasks ?? [], (row) => humanizeKey(row.frequency))}
                  color="#003366"
                />
              </ChartCard>
            </div>
          </div>
          <ReportTableCard
            title="Preventive Maintenance Tasks"
            description="Scheduled PM work with asset, building, frequency, technician, and status."
            rows={preventivePayload?.pm_tasks ?? []}
            fileStem="preventive-maintenance"
            columns={[
              { key: "title", label: "Task" },
              { key: "asset", label: "Asset" },
              { key: "building", label: "Building" },
              { key: "frequency", label: "Frequency", exportValue: (row) => humanizeKey(row.frequency) },
              { key: "technician", label: "Technician" },
              { key: "scheduled_date", label: "Scheduled", exportValue: (row) => formatDate(row.scheduled_date) },
              { key: "status", label: "Status", exportValue: (row) => humanizeKey(row.status) },
            ]}
          />
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${accent}`}>{label}</div>
      <p className="mt-4 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/15"
      >
        {children}
      </select>
    </div>
  );
}

function InputField({
  label,
  value,
  type,
  onChange,
}: {
  label: string;
  value: string;
  type: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#003366] focus:ring-2 focus:ring-[#003366]/15"
      />
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function SimpleLegend({ rows }: { rows: Array<{ label: string; value: string }> }) {
  if (rows.length === 0) {
    return <EmptyState copy="No data available for this section." />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
            <span className="text-sm font-bold text-slate-700">{row.label}</span>
          </div>
          <span className="text-sm font-black text-slate-900">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function HorizontalBarChart({ rows, color }: { rows: Array<{ name: string; value: number }>; color: string }) {
  if (rows.length === 0) {
    return <EmptyState copy="No chart data in the selected range." />;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} layout="vertical" margin={{ left: 30, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" />
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fontWeight: 700, fill: "#1e293b" }} width={120} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function VerticalBarChart({ rows, color }: { rows: Array<{ name: string; value: number }>; color: string }) {
  if (rows.length === 0) {
    return <EmptyState copy="No chart data in the selected range." />;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} barSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function GroupedBarChart({ rows }: { rows: Array<{ name: string; assigned: number; completed: number }> }) {
  if (rows.length === 0) {
    return <EmptyState copy="No technician data in the selected range." />;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={rows} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: "#334155" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="assigned" fill="#003366" radius={[6, 6, 0, 0]} barSize={24} />
        <Bar dataKey="completed" fill="#22c55e" radius={[6, 6, 0, 0]} barSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ReportTableCard<T>({
  title,
  description,
  rows,
  columns,
  fileStem,
}: {
  title: string;
  description: string;
  rows: T[];
  columns: TableColumn<T>[];
  fileStem: string;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const rowHeight = 44;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage]
  );
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 8;
  const endIndex = Math.min(pagedRows.length, startIndex + visibleCount);
  const visibleRows = pagedRows.slice(startIndex, endIndex);
  const topSpacerHeight = startIndex * rowHeight;
  const bottomSpacerHeight = Math.max(0, (pagedRows.length - endIndex) * rowHeight);

  useEffect(() => {
    setPage(1);
    setScrollTop(0);
    viewportRef.current?.scrollTo({ top: 0 });
  }, [rows.length]);

  useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > nextTotalPages) {
      setPage(nextTotalPages);
    }
  }, [page, rows.length]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const syncHeight = () => setViewportHeight(node.clientHeight || 520);
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, []);

  const exportRows = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.label, column.exportValue ? column.exportValue(row) : String((row as Record<string, unknown>)[column.key] ?? "")]))
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => downloadCsv(`${fileStem}.csv`, exportRows)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
          >
            <FileSpreadsheet size={14} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => downloadExcelCsv(`${fileStem}.xls`, exportRows)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-700"
          >
            <Download size={14} />
            Excel
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <p className="text-xs font-semibold text-slate-500">
          {rows.length} rows total - page {safePage} / {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
      <div ref={viewportRef} className="max-h-[520px] overflow-auto" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
        <table className="w-full min-w-190 text-left">
          <thead>
            <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
              {columns.map((column) => (
                <th key={column.key} className={`px-4 py-3 ${column.align === "right" ? "text-right" : "text-left"}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topSpacerHeight > 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ height: `${topSpacerHeight}px` }} />
              </tr>
            ) : null}
            {visibleRows.map((row, offset) => {
              const rowIndex = startIndex + offset;
              return (
              <tr key={rowIndex} className="text-sm transition hover:bg-slate-50/80">
                {columns.map((column) => (
                  <td key={`${column.key}-${rowIndex}`} className={`px-4 py-3 font-semibold text-slate-700 ${column.align === "right" ? "text-right" : "text-left"}`}>
                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "-")}
                  </td>
                ))}
              </tr>
            );
            })}
            {bottomSpacerHeight > 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ height: `${bottomSpacerHeight}px` }} />
              </tr>
            ) : null}
            {pagedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm font-semibold text-slate-400">
                  No rows available for this report.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
      <AlertTriangle size={18} />
      {message}
    </div>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return <p className="flex h-55 items-center justify-center text-center text-sm font-semibold text-slate-400">{copy}</p>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value || 0);
}

function formatPercent(value: number) {
  return Number(value || 0).toFixed(2).replace(/\.00$/, "");
}

function formatNumber(value: number) {
  return Number(value || 0).toFixed(2).replace(/\.00$/, "");
}

function formatDate(value?: string) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function humanizeKey(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toSlices<T extends Record<string, unknown>>(rows: T[], nameKey: keyof T, totalKey: keyof T, percentageKey?: keyof T) {
  const total = rows.reduce((sum, row) => sum + Number(row[totalKey] ?? 0), 0);
  return rows.slice(0, 6).map((row) => ({
    name: String(row[nameKey] ?? ""),
    total: Number(row[totalKey] ?? 0),
    percentage: percentageKey ? Number(row[percentageKey] ?? 0) : total > 0 ? Number(((Number(row[totalKey] ?? 0) / total) * 100).toFixed(2)) : 0,
  }));
}

function countByLabel<T>(rows: T[], getLabel: (row: T) => string) {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    const label = getLabel(row);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function shortenName(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length <= 1) return value;
  return `${parts[0]} ${parts[1][0]}.`;
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  downloadDelimited(filename, rows, ",", "text/csv;charset=utf-8;");
}

function downloadExcelCsv(filename: string, rows: Array<Record<string, string | number>>) {
  downloadDelimited(filename, rows, "\t", "application/vnd.ms-excel;charset=utf-8;");
}

function downloadDelimited(filename: string, rows: Array<Record<string, string | number>>, delimiter: string, mimeType: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(delimiter),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = String(row[header] ?? "");
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(delimiter)
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
