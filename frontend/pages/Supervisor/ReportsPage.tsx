"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, readAuthUser } from "@/lib/api";
import { FileSpreadsheet, Printer, FileText } from "lucide-react";

type Option = { id: number; name: string };
type Period = "today" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
type ReportType = "maintenance_summary" | "technician_performance" | "spare_part_usage_cost" | "asset_report";
type TechnicianSort = "volume" | "completion_time";

type SummaryCard = { label: string; count: number; percentage: number };
type CountPctRow = { name?: string; status?: string; count: number; percentage: number };
type LocationRow = { name: string; count: number; percentage: number };
type TechnicianRow = {
  technician_name: string;
  specialization: string;
  assigned_volume: number;
  completed_volume: number;
  resolution_rate: number;
  average_duration_hours: number;
  average_duration_days: number;
  pending_load: number;
};
type SpareLogRow = {
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
};
type SpendDepartmentRow = { department: string; total_cost: number };
type SpendBuildingRow = { building: string; total_cost: number };
type LowStockRow = { id: number; name: string; part_code: string; quantity_available: number; reorder_point: number };
type AssetProfileRow = {
  asset_id: number;
  asset_name: string;
  brand: string;
  serial_number: string;
  installation_date: string;
  building: string;
  repair_history_count: number;
  current_condition: string;
  replacement_signal: string;
};

type ReportPayload = {
  purpose?: string;
  summary_cards?: SummaryCard[];
  request_volume?: {
    received: number;
    completed: number;
    completion_rate: number;
    emergency_count: number;
    normal_count: number;
  };
  priority_breakdown?: CountPctRow[];
  status_counts?: CountPctRow[];
  location_highlights?: {
    departments?: LocationRow[];
    buildings?: LocationRow[];
  };
  ranked_technicians?: TechnicianRow[];
  sort_options?: string[];
  consumption_log?: SpareLogRow[];
  total_cost?: number;
  spend_by_department?: SpendDepartmentRow[];
  spend_by_building?: SpendBuildingRow[];
  low_stock_alerts?: LowStockRow[];
  waste_tracking?: {
    issued_quantity: number;
    installed_quantity: number;
    waste_quantity: number;
  };
  asset_profiles?: AssetProfileRow[];
};

type Summary = {
  from: string;
  to: string;
  report_type: ReportType;
  total_requests: number;
  completed_percent: number;
  overdue_percent: number;
  average_resolution_time_hours: number;
  top_departments?: Array<{ name: string; total: number }>;
  report_payload?: ReportPayload;
};

type ReportResponse = { success: boolean; summary: Summary };
type AuthUser = { fname?: string; lname?: string; email?: string };
type AnalyticsOptionsResponse = {
  filter_options?: {
    departments?: Option[];
    buildings?: Option[];
    categories?: Option[];
    assets?: Option[];
  };
};

const REPORT_TYPES: Array<{ value: ReportType; label: string }> = [
  { value: "maintenance_summary", label: "Maintenance Summary Report" },
  { value: "technician_performance", label: "Technician Performance Report" },
  { value: "spare_part_usage_cost", label: "Spare Part Usage and Cost Analysis Report" },
  { value: "asset_report", label: "Asset Report" },
];

const pct = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const money = (value: number) => `KES ${Number(value || 0).toFixed(2)}`;

const pad2 = (value: number) => String(value).padStart(2, "0");
const formatDate = (value?: string | Date | null) => {
  if (!value) return "--/--/--";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "--/--/--";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
};
const formatTime = (value?: string | Date | null) => {
  if (!value) return "--:--";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const formatDateTime = (value?: string | Date | null) => `${formatDate(value)} ${formatTime(value)}`;

const withPercentAndCount = (count: number, total: number, unit: string) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return `${pct(percentage)} (${count} ${unit})`;
};

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType | "">("");
  const [period, setPeriod] = useState<Period>("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [department, setDepartment] = useState("");
  const [building, setBuilding] = useState("");
  const [overall, setOverall] = useState(false);
  const [category, setCategory] = useState("");
  const [asset, setAsset] = useState("");
  const [technicianSort, setTechnicianSort] = useState<TechnicianSort>("volume");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [generatedBy, setGeneratedBy] = useState("Supervisor");
  const reportRef = useRef<HTMLDivElement | null>(null);
  const selectedReportLabel = REPORT_TYPES.find((t) => t.value === reportType)?.label ?? "Maintenance Report";
  const payload = summary?.report_payload;

  const [options, setOptions] = useState<{
    departments: Option[];
    buildings: Option[];
    categories: Option[];
    assets: Option[];
  }>({ departments: [], buildings: [], categories: [], assets: [] });

  useEffect(() => {
    const user = readAuthUser<AuthUser>();
    const name = `${user?.fname ?? ""} ${user?.lname ?? ""}`.trim() || "Supervisor";
    setGeneratedBy(name);
  }, []);

  const buildQuery = () => {
    const q = new URLSearchParams();
    if (reportType) q.set("report_type", reportType);
    q.set("period", period);
    if (period === "custom") {
      if (from) q.set("from", from);
      if (to) q.set("to", to);
    }
    if (overall) {
      q.set("overall", "1");
    } else {
      if (department) q.set("department", department);
      if (building) q.set("building", building);
    }
    if (category) q.set("category", category);
    if (asset) q.set("asset", asset);
    return q.toString();
  };

  const loadFilterOptions = useCallback(async () => {
    const data = await apiRequest<AnalyticsOptionsResponse>(`/api/analytics?period=${period}`, { method: "GET" }, true);
    setOptions({
      departments: data?.filter_options?.departments ?? [],
      buildings: data?.filter_options?.buildings ?? [],
      categories: data?.filter_options?.categories ?? [],
      assets: data?.filter_options?.assets ?? [],
    });
  }, [period]);

  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions]);

  const generateReport = async () => {
    if (!reportType) {
      setError("Select report type first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const report = await apiRequest<ReportResponse>(`/api/supervisor/reports?${buildQuery()}`, { method: "GET" }, true);
      setSummary(report.summary);
      setGeneratedAt(new Date());
    } catch {
      setError("Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  const technicianRows = useMemo(() => {
    const rows = [...(payload?.ranked_technicians ?? [])];
    if (technicianSort === "completion_time") {
      rows.sort((a, b) => a.average_duration_hours - b.average_duration_hours);
      return rows;
    }
    rows.sort((a, b) => b.assigned_volume - a.assigned_volume);
    return rows;
  }, [payload?.ranked_technicians, technicianSort]);

  const buildExcelRows = () => {
    if (!summary) return [] as Array<[string, string]>;
    const rows: Array<[string, string]> = [
      ["Report Title", selectedReportLabel],
      ["Generated By", generatedBy],
      ["Generated At", formatDateTime(generatedAt)],
      ["Range", `${formatDate(summary.from)} to ${formatDate(summary.to)}`],
      ["Total Requests", `100.0% (${summary.total_requests} requests)`],
      ["Completed", `${pct(summary.completed_percent)} (${Math.round((summary.completed_percent / 100) * summary.total_requests)} requests)`],
      ["Overdue", `${pct(summary.overdue_percent)} (${Math.round((summary.overdue_percent / 100) * summary.total_requests)} requests)`],
    ];

    if (summary.report_type === "maintenance_summary") {
      rows.push(["", ""]);
      rows.push(["Status", "Count + Percent"]);
      for (const item of payload?.status_counts ?? []) {
        rows.push([(item.status ?? "Unknown").toUpperCase(), withPercentAndCount(item.count, summary.total_requests, "requests")]);
      }
    }

    if (summary.report_type === "technician_performance") {
      rows.push(["", ""]);
      rows.push(["Technician", "Resolution / Duration / Pending"]);
      for (const tech of payload?.ranked_technicians ?? []) {
        rows.push([
          `${tech.technician_name} (${tech.specialization})`,
          `${pct(tech.resolution_rate)} (${tech.completed_volume}/${tech.assigned_volume}) | ${tech.average_duration_hours}h | Pending: ${tech.pending_load}`,
        ]);
      }
    }

    if (summary.report_type === "spare_part_usage_cost") {
      rows.push(["", ""]);
      rows.push(["Part Consumption Log", "WO / Qty Issued / Qty Installed / Waste / Cost"]);
      for (const item of payload?.consumption_log ?? []) {
        rows.push([
          `${item.part_name} (${item.part_code})`,
          `WO-${item.work_order_id} | ${item.quantity_issued}/${item.quantity_installed} | Waste ${item.waste_quantity} | ${money(item.total_cost)}`,
        ]);
      }
      rows.push(["Total Cost", money(payload?.total_cost ?? 0)]);
    }

    if (summary.report_type === "asset_report") {
      rows.push(["", ""]);
      rows.push(["Asset", "Serial / Install Date / Repairs / Condition"]);
      for (const item of payload?.asset_profiles ?? []) {
        rows.push([
          `${item.asset_name} (${item.brand})`,
          `${item.serial_number} | ${formatDate(item.installation_date)} | Repairs ${item.repair_history_count} | ${item.current_condition}`,
        ]);
      }
    }

    return rows;
  };

  const downloadExcel = async () => {
    if (!summary) {
      setError("Generate report first before downloading Excel.");
      return;
    }
    try {
      setError(null);
      const rows = buildExcelRows();
      const csv = rows.map(([a, b]) => `"${a.replace(/"/g, '""')}","${b.replace(/"/g, '""')}"`).join("\n");
      const blob = new Blob(["\uFEFF", csv], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `maintenance-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Excel export failed.");
    }
  };

  const printFromIframe = (reportHtml: string) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      setError("Unable to open print preview.");
      return;
    }

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Supervisor Report</title>
          <style>
            html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; color: #000; background: #fff; overflow: visible; }
            * { box-sizing: border-box; color: #000; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #000; color: #fff; text-transform: uppercase; }
            .print-only-container { max-width: 980px; margin: 0 auto; padding: 24px; }
            @page { size: A4; margin: 12mm; }
          </style>
        </head>
        <body>
          <div class="print-only-container">${reportHtml}</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1500);
    }, 300);
  };

  const downloadPdf = () => {
    if (!summary || !reportRef.current) {
      setError("Generate report first before downloading PDF.");
      return;
    }
    try {
      setError(null);
      printFromIframe(reportRef.current.innerHTML);
    } catch {
      setError("PDF export failed.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-6">
      <div className="print:hidden flex flex-col gap-4 border-b-4 border-black pb-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Maintenance Reports</h1>
        <div className="flex gap-2">
          <button onClick={downloadExcel} className="flex items-center gap-2 border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase text-black transition-all hover:bg-black hover:text-white">
            <FileSpreadsheet size={14} /> Export Excel
          </button>
          <button onClick={downloadPdf} className="flex items-center gap-2 border-2 border-black bg-white px-4 py-2 text-xs font-black uppercase text-black transition-all hover:bg-black hover:text-white">
            <FileText size={14} /> Download PDF
          </button>
          <button
            onClick={() => {
              if (!summary || !reportRef.current) {
                setError("Generate report first before printing.");
                return;
              }
              setError(null);
              printFromIframe(reportRef.current.innerHTML);
            }}
            className="flex items-center gap-2 border-2 border-black bg-black px-4 py-2 text-xs font-black uppercase text-white transition-all hover:bg-white hover:text-black"
          >
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      <div className="print:hidden border-2 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-black">Report Type</label>
            <select className="border-2 border-black bg-white p-2 text-sm font-bold text-black outline-none" value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
              <option value="" className="text-black">Select report type</option>
              {REPORT_TYPES.map((type) => <option key={type.value} value={type.value} className="text-black">{type.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-black">Timeframe</label>
            <select className="border-2 border-black bg-white p-2 text-sm font-bold text-black outline-none" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              <option value="today" className="text-black">Today</option>
              <option value="weekly" className="text-black">This Week</option>
              <option value="monthly" className="text-black">This Month</option>
              <option value="custom" className="text-black">Custom Range</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-black">From Date (dd/mm/yy)</label>
            <input className="border-2 border-black bg-white p-2 text-sm font-bold text-black placeholder:text-black" type="date" value={from} disabled={period !== "custom"} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-black">To Date (dd/mm/yy)</label>
            <input className="border-2 border-black bg-white p-2 text-sm font-bold text-black placeholder:text-black" type="date" value={to} disabled={period !== "custom"} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 border-t-2 border-black pt-4 md:grid-cols-4">
          <select className="border-2 border-black bg-white p-2 text-sm font-bold text-black disabled:bg-zinc-100 disabled:text-black" value={department} disabled={overall} onChange={(e) => setDepartment(e.target.value)}>
            <option value="" className="text-black">Select department</option>
            {options.departments.map((d) => <option key={d.id} value={d.id} className="text-black">{d.name}</option>)}
          </select>
          <select className="border-2 border-black bg-white p-2 text-sm font-bold text-black disabled:bg-zinc-100 disabled:text-black" value={building} disabled={overall} onChange={(e) => setBuilding(e.target.value)}>
            <option value="" className="text-black">Select building</option>
            {options.buildings.map((b) => <option key={b.id} value={b.id} className="text-black">{b.name}</option>)}
          </select>
          <select className="border-2 border-black bg-white p-2 text-sm font-bold text-black" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="" className="text-black">Select category</option>
            {options.categories.map((c) => <option key={c.id} value={c.id} className="text-black">{c.name}</option>)}
          </select>
          <select className="border-2 border-black bg-white p-2 text-sm font-bold text-black" value={asset} onChange={(e) => setAsset(e.target.value)}>
            <option value="" className="text-black">Select asset</option>
            {options.assets.map((a) => <option key={a.id} value={a.id} className="text-black">{a.name}</option>)}
          </select>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="inline-flex items-center gap-2 text-xs font-black uppercase text-black">
            <input type="checkbox" checked={overall} onChange={(e) => setOverall(e.target.checked)} className="h-4 w-4 border-2 border-black accent-black" />
            Overall Report (Ignore Department And Building)
          </label>

          <button onClick={generateReport} disabled={loading} className="border-2 border-black bg-black px-5 py-2.5 text-xs font-black uppercase text-white transition-all hover:bg-white hover:text-black">
            {loading ? "Loading..." : "Generate Report"}
          </button>
        </div>
      </div>

      {summary && (
        <div ref={reportRef} className="space-y-6 border-2 border-black bg-white p-8 print:border-0 print:p-0">
          <div className="border-b-4 border-black pb-4">
            <h2 className="text-2xl font-black uppercase text-black">{selectedReportLabel}</h2>
            <p className="mt-2 text-xs font-bold uppercase text-black">
              Generated By: {generatedBy.toUpperCase()} | Date: {formatDate(generatedAt)} | Time: {formatTime(generatedAt)}
            </p>
            <p className="mt-1 text-xs font-bold uppercase text-black">
              Range: {formatDate(summary.from)} to {formatDate(summary.to)}
            </p>
            <p className="mt-1 text-xs font-bold text-black">{payload?.purpose ?? ""}</p>
          </div>

          {summary.report_type === "maintenance_summary" && (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                {(payload?.summary_cards ?? []).map((card) => (
                  <div key={card.label} className="border-2 border-black bg-white p-3">
                    <p className="text-[10px] font-black uppercase text-black">{card.label}</p>
                    <p className="mt-1 text-lg font-black text-black">{withPercentAndCount(card.count, summary.total_requests, "requests")}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-black uppercase text-black">Priority Breakdown</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-black text-left text-xs font-black uppercase text-white">
                        <th className="border border-black p-2">Priority</th>
                        <th className="border border-black p-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-bold uppercase text-black">
                      {(payload?.priority_breakdown ?? []).map((item, idx) => (
                        <tr key={`${item.name}-${idx}`}>
                          <td className="border border-black p-2">{item.name}</td>
                          <td className="border border-black p-2 text-right">{withPercentAndCount(item.count, summary.total_requests, "requests")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-black uppercase text-black">Status Count (Grouped List)</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-black text-left text-xs font-black uppercase text-white">
                        <th className="border border-black p-2">Status</th>
                        <th className="border border-black p-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-bold uppercase text-black">
                      {(payload?.status_counts ?? []).map((item, idx) => (
                        <tr key={`${item.status}-${idx}`}>
                          <td className="border border-black p-2">{(item.status ?? "unknown").replace("_", " ")}</td>
                          <td className="border border-black p-2 text-right">{withPercentAndCount(item.count, summary.total_requests, "tasks")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-black uppercase text-black">Top Departments</h3>
                  {(payload?.location_highlights?.departments ?? []).map((d, idx) => (
                    <div key={`${d.name}-${idx}`} className="mb-2 flex items-center justify-between border-2 border-black px-3 py-2 text-xs font-bold text-black">
                      <span>{d.name}</span>
                      <span>{withPercentAndCount(d.count, summary.total_requests, "requests")}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-black uppercase text-black">Top Buildings</h3>
                  {(payload?.location_highlights?.buildings ?? []).map((b, idx) => (
                    <div key={`${b.name}-${idx}`} className="mb-2 flex items-center justify-between border-2 border-black px-3 py-2 text-xs font-bold text-black">
                      <span>{b.name}</span>
                      <span>{withPercentAndCount(b.count, summary.total_requests, "requests")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {summary.report_type === "technician_performance" && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase text-black">Ranked Technician Table</h3>
                <select className="border-2 border-black bg-white p-2 text-xs font-black uppercase text-black" value={technicianSort} onChange={(e) => setTechnicianSort(e.target.value as TechnicianSort)}>
                  <option value="volume" className="text-black">Sort By Volume</option>
                  <option value="completion_time" className="text-black">Sort By Completion Time</option>
                </select>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-black text-left text-xs font-black uppercase text-white">
                    <th className="border border-black p-2">Technician</th>
                    <th className="border border-black p-2">Specialization</th>
                    <th className="border border-black p-2 text-right">Resolution Rate</th>
                    <th className="border border-black p-2 text-right">Avg Duration</th>
                    <th className="border border-black p-2 text-right">Pending Load</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-black">
                  {technicianRows.map((tech, idx) => (
                    <tr key={`${tech.technician_name}-${idx}`}>
                      <td className="border border-black p-2">{tech.technician_name}</td>
                      <td className="border border-black p-2">{tech.specialization}</td>
                      <td className="border border-black p-2 text-right">{pct(tech.resolution_rate)} ({tech.completed_volume}/{tech.assigned_volume})</td>
                      <td className="border border-black p-2 text-right">{tech.average_duration_hours.toFixed(1)}h ({tech.average_duration_days.toFixed(1)}d)</td>
                      <td className="border border-black p-2 text-right">{tech.pending_load} ({pct(tech.assigned_volume > 0 ? (tech.pending_load / tech.assigned_volume) * 100 : 0)})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {summary.report_type === "spare_part_usage_cost" && (
            <>
              <h3 className="text-sm font-black uppercase text-black">Consumption Log And Cost Table</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-black text-left text-xs font-black uppercase text-white">
                    <th className="border border-black p-2">Date/Time</th>
                    <th className="border border-black p-2">WO ID</th>
                    <th className="border border-black p-2">Part</th>
                    <th className="border border-black p-2 text-right">Issued</th>
                    <th className="border border-black p-2 text-right">Installed</th>
                    <th className="border border-black p-2 text-right">Waste</th>
                    <th className="border border-black p-2 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-black">
                  {(payload?.consumption_log ?? []).map((row, idx) => (
                    <tr key={`${row.work_order_id}-${row.part_code}-${idx}`}>
                      <td className="border border-black p-2">{formatDateTime(row.issue_date)}</td>
                      <td className="border border-black p-2">WO-{row.work_order_id}</td>
                      <td className="border border-black p-2">{row.part_name} ({row.part_code})</td>
                      <td className="border border-black p-2 text-right">{row.quantity_issued}</td>
                      <td className="border border-black p-2 text-right">{row.quantity_installed}</td>
                      <td className="border border-black p-2 text-right">{row.waste_quantity}</td>
                      <td className="border border-black p-2 text-right">{money(row.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-black text-xs font-black uppercase text-white">
                    <td colSpan={6} className="border border-black p-2 text-right">Total Cost</td>
                    <td className="border border-black p-2 text-right">{money(payload?.total_cost ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-xs font-black uppercase text-black">Low Stock Alerts</h4>
                  {(payload?.low_stock_alerts ?? []).map((item) => (
                    <div key={item.id} className="mb-2 flex items-center justify-between border-2 border-black px-3 py-2 text-xs font-bold text-black">
                      <span>{item.name} ({item.part_code})</span>
                      <span>{item.quantity_available}/{item.reorder_point}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-black uppercase text-black">Waste Tracking</h4>
                  <div className="space-y-2 text-xs font-bold text-black">
                    <div className="border-2 border-black p-2">Issued: {payload?.waste_tracking?.issued_quantity ?? 0}</div>
                    <div className="border-2 border-black p-2">Installed: {payload?.waste_tracking?.installed_quantity ?? 0}</div>
                    <div className="border-2 border-black p-2">Waste: {payload?.waste_tracking?.waste_quantity ?? 0}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {summary.report_type === "asset_report" && (
            <>
              <h3 className="text-sm font-black uppercase text-black">Asset Profile And Condition Report</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-black text-left text-xs font-black uppercase text-white">
                    <th className="border border-black p-2">Asset</th>
                    <th className="border border-black p-2">Brand</th>
                    <th className="border border-black p-2">Serial Number</th>
                    <th className="border border-black p-2">Install Date</th>
                    <th className="border border-black p-2 text-right">Repair History</th>
                    <th className="border border-black p-2">Condition</th>
                    <th className="border border-black p-2">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-bold text-black">
                  {(payload?.asset_profiles ?? []).map((assetItem) => (
                    <tr key={assetItem.asset_id}>
                      <td className="border border-black p-2">{assetItem.asset_name}</td>
                      <td className="border border-black p-2">{assetItem.brand}</td>
                      <td className="border border-black p-2">{assetItem.serial_number}</td>
                      <td className="border border-black p-2">{formatDate(assetItem.installation_date)}</td>
                      <td className="border border-black p-2 text-right">{assetItem.repair_history_count}</td>
                      <td className="border border-black p-2">{assetItem.current_condition}</td>
                      <td className="border border-black p-2">{assetItem.replacement_signal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="mt-10 flex justify-end">
            <div className="w-64 border-t-2 border-black pt-2 text-center">
              <p className="text-[10px] font-black uppercase text-black">Authorized Signature</p>
            </div>
          </div>
        </div>
      )}

      {error && <div className="border-2 border-rose-700 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</div>}

      {!summary && !loading && (
        <div className="border border-slate-300 bg-white p-4 text-sm text-slate-700">
          Select report type first, then generate report. Date and time display format is `dd/mm/yy hh:mm` in all report outputs.
        </div>
      )}
    </div>
  );
}

