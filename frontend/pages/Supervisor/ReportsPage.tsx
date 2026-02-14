"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

type Summary = {
  total_requests: number;
  completed_percent: number;
  overdue_percent: number;
  spare_part_total_cost: number;
  average_resolution_time_hours: number;
};

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = async () => {
    const data = await apiRequest<{ success: boolean; summary: Summary }>("/api/supervisor/reports?period=monthly", { method: "GET" }, true);
    setSummary(data.summary);
  };

  const exportExcel = async () => {
    const url = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/api/supervisor/reports?period=monthly&export=excel`;
    const token = localStorage.getItem("auth_token");
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "report.csv";
    a.click();
  };

  const exportPdf = async () => {
    const data = await apiRequest<{ success: boolean; summary: Summary; copy_summary: string }>("/api/supervisor/reports?period=monthly&export=pdf", { method: "GET" }, true);
    const content = `Maintenance Report\n\n${data.copy_summary}`;
    const blob = new Blob([content], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "report.pdf";
    a.click();
  };

  const copySummary = async () => {
    const data = await apiRequest<{ success: boolean; copy_summary: string }>("/api/supervisor/reports?period=monthly&export=copy", { method: "GET" }, true);
    await navigator.clipboard.writeText(data.copy_summary);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Reports</h1>
      <div className="flex gap-2">
        <button onClick={load} className="px-3 py-2 bg-[#003366] text-white rounded-lg text-xs font-bold">Generate Monthly</button>
        <button onClick={exportExcel} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold">Export Excel</button>
        <button onClick={exportPdf} className="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold">Export PDF</button>
        <button onClick={() => window.print()} className="px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-bold">Print</button>
        <button onClick={copySummary} className="px-3 py-2 bg-slate-200 text-slate-900 rounded-lg text-xs font-bold">Copy Summary</button>
      </div>
      {summary && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm space-y-2">
          <p>Total Requests: <span className="font-black">{summary.total_requests}</span></p>
          <p>Completed %: <span className="font-black">{summary.completed_percent}</span></p>
          <p>Overdue %: <span className="font-black">{summary.overdue_percent}</span></p>
          <p>Spare Part Cost: <span className="font-black">{summary.spare_part_total_cost}</span></p>
          <p>Avg Resolution Hours: <span className="font-black">{summary.average_resolution_time_hours}</span></p>
        </div>
      )}
    </div>
  );
}

