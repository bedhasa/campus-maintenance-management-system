"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { buildStorageUrl } from "@/lib/runtime-config";
import PageSkeleton from "@/components/PageSkeleton";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { buildWorkOrderRealtimeTopics, emitRealtimeTopics } from "@/lib/realtime";
import { 
  BookOpen, Clock, HardHat, AlertCircle, MapPin, 
  Calendar, Phone, Mail, ChevronLeft, 
  FileText, ShieldAlert, CheckCircle2, Building2, Wrench
} from "lucide-react";
import Link from "next/link";

interface Props { id: string; }

type CompletionReport = {
  id: number;
  completion_note?: string | null;
  resolution_summary?: string | null;
  issue_reported?: string | null;
  problem_found?: string | null;
  probable_cause?: string | null;
  probable_cause_custom?: string | null;
  diagnostic_steps?: string[] | null;
  action_taken?: string | null;
  downtime_hours?: number | string | null;
  delay_reason?: string | null;
  image_path?: string | null;
  attachment_paths?: string[] | null;
  submitted_at?: string | null;
  technician?: { fname?: string; lname?: string } | null;
  spare_parts?: Array<{
    id: number;
    quantity_used?: number;
    unit_price?: number | string | null;
    total_price?: number | string | null;
    spare_part?: {
      id?: number;
      name?: string;
      part_code?: string | null;
    } | null;
  }>;
};

type SimilarCompletionCase = {
  work_order_id: number;
  previous_problem?: string | null;
  root_cause?: string | null;
  action_taken?: string | null;
  completed_at?: string | null;
  spare_parts?: Array<{ name?: string; part_code?: string | null; quantity_used?: number }>;
};

type WorkOrderDetail = {
  id: number;
  priority: string;
  work_status: string;
  completion_note?: string | null;
  delay_reason?: string | null;
  statusLogs?: Array<{
    id: number;
    comment?: string | null;
    created_at?: string;
  }>;
  technician_completion_report?: CompletionReport | null;
  similar_completion_cases?: SimilarCompletionCase[];
  assignee?: { fname?: string; lname?: string; phone?: string; email?: string };
  request?: { 
    title?: string; 
    description?: string; 
    status?: string; 
    requester_id?: number;
    due_date?: string | null; 
    category_id?: number;
    requester?: { fname?: string; lname?: string; phone?: string; email?: string; profile_picture_url?: string | null };
    statusLogs?: Array<{
      id: number;
      comment?: string | null;
      created_at?: string;
      changedBy?: { fname?: string; lname?: string } | null;
    }>;
    category?: { name?: string }; 
    building?: { name?: string }; 
    room?: { name?: string } 
  };
};

type TechnicianOption = {
  id: number;
  fname?: string;
  lname?: string;
  phone?: string;
  email?: string;
};

const priorityMap: Record<string, string> = {
  urgent: "bg-rose-100 text-rose-700 border-rose-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

const getImageUrl = (path?: string | null) => {
  return buildStorageUrl(path);
};

function formatMoney(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
};

export default function WorkOrderDetailPage({ id }: Props) {
  const params = useSearchParams();
  const delayRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<WorkOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [techLoading, setTechLoading] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [finishDate, setFinishDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("medium");

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/supervisor/work-orders/${id}`, { method: "GET" }, true
      );
      setData(res.work_order);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load work order details.";
      setError(message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const realtimeTopics = useMemo(() => buildWorkOrderRealtimeTopics(id), [id]);

  useLiveRefresh(load, {
    enabled: true,
    topics: realtimeTopics,
    refreshOnFocus: false,
  });

  const closeManualWorkOrder = async () => {
    try {
      setClosing(true);
      setError(null);
      setSuccessMessage(null);
      const res = await apiRequest<{ success: boolean; message?: string; work_order?: WorkOrderDetail }>(
        `/api/supervisor/work-orders/${id}/close`,
        { method: "PATCH" },
        true
      );
      if (res.work_order) {
        setData(res.work_order);
      }
      setSuccessMessage(res.message ?? "Manual work order closed.");
      emitRealtimeTopics(buildWorkOrderRealtimeTopics(id), { workOrderId: id, action: "close" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close manual work order.");
    } finally {
      setClosing(false);
    }
  };

  const openReassignModal = async () => {
    const categoryId = data?.request?.category_id;
    if (!categoryId) {
      setError("Request category is missing; cannot load matched technicians.");
      return;
    }
    try {
      setTechLoading(true);
      setError(null);
      const res = await apiRequest<{ success: boolean; technicians: TechnicianOption[] }>(
        `/api/supervisor/technicians/by-category?category_id=${categoryId}`,
        { method: "GET" },
        true
      );
      const techList = res.technicians ?? [];
      setTechnicians(techList);
      setSelectedTechId(techList[0]?.id ? String(techList[0].id) : "");
      setStartDate("");
      setFinishDate("");
      setScheduledTime("");
      setDueDate(data?.request?.due_date ? data.request.due_date.slice(0, 10) : "");
      setSelectedPriority(data?.priority ?? "medium");
      setReassignOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load technicians.");
    } finally {
      setTechLoading(false);
    }
  };

  const reassignWorkOrder = async () => {
    if (!selectedTechId) return;
    try {
      setReassigning(true);
      setError(null);
      setSuccessMessage(null);
      const res = await apiRequest<{ success: boolean; message?: string }>(
        `/api/supervisor/work-orders/${id}/reassign`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_to: Number(selectedTechId),
            start_date: startDate || null,
            finish_date: finishDate || null,
            due_date: dueDate || null,
            scheduled_time: scheduledTime || null,
            priority: selectedPriority || null,
          }),
        },
        true
      );
      setSuccessMessage(res.message ?? "Work order reassigned.");
      setReassignOpen(false);
      emitRealtimeTopics(buildWorkOrderRealtimeTopics(id), { workOrderId: id, action: "reassign" });
      const refreshed = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/supervisor/work-orders/${id}`,
        { method: "GET" },
        true
      );
      setData(refreshed.work_order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reassign work order.");
    } finally {
      setReassigning(false);
    }
  };

 useEffect(() => {
    // We add the ?. check to 'params'
    if (params?.get("scroll") === "delay" && delayRef.current) {
      delayRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [params, data]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
        {error}
      </div>
    );
  }

  if (!data) return <PageSkeleton cards={2} rows={3} />;

  const manualClosed = !data.request && (data.statusLogs ?? []).some((log) =>
    (log.comment ?? '').toLowerCase().includes('manual work order approved and closed by supervisor.')
  );
  const completionReport = data.technician_completion_report;
  const completionNote = completionReport?.completion_note ?? data.completion_note;
  const completionDelayReason = completionReport?.delay_reason ?? data.delay_reason;
  const declineLog = (data.request?.statusLogs ?? []).find((log) =>
    (log.comment ?? "").toLowerCase().includes("technician declined assignment")
  );
  const declineActor = declineLog?.changedBy
    ? `${declineLog.changedBy.fname ?? ""} ${declineLog.changedBy.lname ?? ""}`.trim()
    : "Technician";

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {successMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {successMessage}
        </div>
      )}
      
      {/* TOP NAVIGATION */}
      <div className="flex items-center justify-between">
        <Link href="/supervisor/work-orders" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#003366] transition-colors">
          <ChevronLeft size={16} /> Back to List
        </Link>
        <div className="flex items-center gap-3">
          {!data.request && data.work_status === 'completed' && !manualClosed && (
            <button
              type="button"
              onClick={() => void closeManualWorkOrder()}
              disabled={closing}
              className="rounded-full bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
            >
              {closing ? 'Closing...' : 'Close Manual Work Order'}
            </button>
          )}
          {manualClosed && (
            <span className="rounded-full bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">
              Closed By Supervisor
            </span>
          )}
          {data.request && ['assigned', 'in_progress', 'draft'].includes(data.work_status) && (
            <button
              type="button"
              onClick={() => void openReassignModal()}
              disabled={techLoading}
              className="rounded-full bg-blue-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
            >
              {techLoading ? "Loading..." : "Reassign"}
            </button>
          )}
          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${priorityMap[data.priority] || priorityMap.medium}`}>
            {data.priority} Priority
          </span>
          <span className="px-4 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
            {data.work_status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: MAIN CONTENT */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Header Card */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Work Order Assignment</p>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">#{data.id}: {data.request?.title || "Direct Work Order"}</h1>
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-2rem p-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileText size={14}/> Problem Description
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {data.request?.description ?? "No detailed description provided for this work order."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Building</p>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Building2 size={14} className="text-blue-500"/> {data.request?.building?.name || "Global"}
                </p>
              </div>
              <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Location / Room</p>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <MapPin size={14} className="text-emerald-500"/> {data.request?.room?.name || "General Area"}
                </p>
              </div>
            </div>
          </div>

          {(data.similar_completion_cases?.length ?? 0) > 0 && (
            <div className="rounded-[2.5rem] border border-indigo-100 bg-indigo-50/80 p-8 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-indigo-800">
                <BookOpen size={18} />
                <h3 className="text-sm font-black uppercase tracking-widest">Similar Previous Cases</h3>
              </div>
              <p className="mb-4 text-xs text-indigo-900/80">
                Historical completion knowledge for reference (same asset, category, or keywords).
              </p>
              <div className="space-y-4">
                {data.similar_completion_cases?.map((c) => (
                  <div
                    key={`${c.work_order_id}-${c.completed_at ?? ""}`}
                    className="rounded-2xl border border-indigo-100 bg-white p-4 text-sm text-slate-800 shadow-sm"
                  >
                    <div className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2">
                      <span className="font-black text-slate-900">WO #{c.work_order_id}</span>
                      {c.completed_at ? (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {formatDateTime(c.completed_at)}
                        </span>
                      ) : null}
                    </div>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div>
                        <dt className="font-black uppercase tracking-widest text-slate-400">Previous problem</dt>
                        <dd className="mt-1 text-slate-700">{c.previous_problem || "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-black uppercase tracking-widest text-slate-400">Root cause</dt>
                        <dd className="mt-1 text-slate-700">{c.root_cause || "—"}</dd>
                      </div>
                      <div>
                        <dt className="font-black uppercase tracking-widest text-slate-400">Action taken</dt>
                        <dd className="mt-1 text-slate-700">{c.action_taken || "—"}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DELAY REASON SECTION */}
          {declineLog && (
            <div className="rounded-[2.5rem] border border-amber-200 bg-amber-50 p-8 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-xl bg-amber-500 p-2 text-white">
                  <AlertCircle size={18} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-800">
                  Declined Assignment
                </h3>
              </div>
              <p className="rounded-2xl border border-amber-200/60 bg-white/60 p-4 text-sm font-medium leading-relaxed text-amber-950">
                {declineLog.comment}
              </p>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                {declineActor} • {formatDateTime(declineLog.created_at)}
              </p>
            </div>
          )}

          <div 
            ref={delayRef} 
            className={`rounded-[2.5rem] p-8 border-2 transition-all duration-500 ${
              data.delay_reason 
                ? "bg-rose-50 border-rose-100 shadow-lg shadow-rose-900/5" 
                : "bg-white border-slate-100 opacity-60"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${data.delay_reason ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                <ShieldAlert size={20} />
              </div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${data.delay_reason ? "text-rose-800" : "text-slate-500"}`}>
                Blockers & Delay Log
              </h3>
            </div>
            
            {data.delay_reason ? (
              <div className="space-y-2">
                <p className="text-sm text-rose-700 font-medium leading-relaxed bg-white/50 p-4 rounded-2xl border border-rose-200/50">
                  {data.delay_reason}
                </p>
                <p className="text-[10px] font-bold text-rose-400 uppercase pl-2">Reported by assigned technician</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No delays have been reported for this work order yet.</p>
            )}
          </div>

          {/* MAINTENANCE COMPLETION REPORT */}
          {data.work_status === "completed" && completionReport && (
            <div className="print-completion-report space-y-6 rounded-[2.5rem] border border-emerald-100 bg-white p-8 shadow-sm print:border-slate-300 print:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3 text-emerald-800">
                  <Wrench size={22} />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maintenance record</p>
                    <h3 className="text-lg font-black tracking-tight text-slate-900">
                      Maintenance Completion Report
                    </h3>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  WO #{data.id}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reported problem</p>
                  <div className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                    {completionReport.issue_reported?.trim() ||
                      [data.request?.title, data.request?.description].filter(Boolean).join("\n\n") ||
                      "—"}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actual problem found</p>
                  <div className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                    {completionReport.problem_found || "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Root cause</p>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-800">
                    {[completionReport.probable_cause, completionReport.probable_cause_custom]
                      .filter(Boolean)
                      .join(" — ") || "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Downtime (hours)</p>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-900">
                    {completionReport.downtime_hours !== undefined &&
                    completionReport.downtime_hours !== null &&
                    completionReport.downtime_hours !== ""
                      ? String(completionReport.downtime_hours)
                      : "—"}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Diagnostic steps</p>
                  <ol className="list-decimal space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 pl-8 text-sm text-slate-700">
                    {(completionReport.diagnostic_steps ?? []).map((step, idx) => (
                      <li key={`${idx}-${step.slice(0, 10)}`}>{step}</li>
                    ))}
                    {!(completionReport.diagnostic_steps && completionReport.diagnostic_steps.length) && (
                      <li className="text-slate-400">—</li>
                    )}
                  </ol>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Corrective actions</p>
                  <div className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                    {completionReport.action_taken || "—"}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resolution summary</p>
                  <div className="whitespace-pre-wrap rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-sm font-medium text-emerald-950">
                    {completionReport.resolution_summary || completionNote || "—"}
                  </div>
                </div>
              </div>

              {completionDelayReason ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Delay reason</p>
                  <p className="text-sm text-amber-900">{completionDelayReason}</p>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Spare parts used</p>
                {completionReport.spare_parts && completionReport.spare_parts.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full min-w-[480px] border-collapse text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-2">Part</th>
                          <th className="border-b border-slate-200 px-3 py-2">Qty</th>
                          <th className="border-b border-slate-200 px-3 py-2">Unit</th>
                          <th className="border-b border-slate-200 px-3 py-2">Line total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completionReport.spare_parts.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100">
                            <td className="px-3 py-2 font-bold text-slate-900">
                              {item.spare_part?.name || "—"}
                              <span className="mt-1 block text-[10px] font-bold uppercase text-slate-400">
                                {item.spare_part?.part_code || ""}
                              </span>
                            </td>
                            <td className="px-3 py-2">{item.quantity_used ?? 0}</td>
                            <td className="px-3 py-2">{formatMoney(item.unit_price)}</td>
                            <td className="px-3 py-2 font-semibold">{formatMoney(item.total_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-black text-slate-900">
                          <td colSpan={3} className="px-3 py-2 text-right text-[10px] uppercase tracking-widest">
                            Total
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(
                              completionReport.spare_parts.reduce(
                                (sum, row) => sum + Number(row.total_price ?? 0),
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No spare parts recorded.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attachments</p>
                {(() => {
                  const raw = [
                    ...(completionReport.attachment_paths ?? []),
                    ...(completionReport.image_path &&
                    !(completionReport.attachment_paths ?? []).includes(completionReport.image_path)
                      ? [completionReport.image_path]
                      : []),
                  ];
                  const uniq = Array.from(new Set(raw));
                  return uniq.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {uniq.map((pth) => (
                        <a
                          key={pth}
                          href={getImageUrl(pth)}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"
                        >
                          <img
                            src={getImageUrl(pth)}
                            alt="Completion attachment"
                            className="h-52 w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No images attached.</p>
                  );
                })()}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                <Clock size={14} />
                {completionReport.submitted_at ? (
                  <span>Completed {formatDateTime(completionReport.submitted_at)}</span>
                ) : null}
                {completionReport.technician ? (
                  <span className="text-slate-700">
                    Technician{" "}
                    <span className="font-black text-slate-900">
                      {completionReport.technician.fname} {completionReport.technician.lname}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {data.work_status === "completed" && !completionReport && (
            <div className="flex items-center gap-3 rounded-[2.5rem] border border-emerald-100 bg-emerald-50 p-6 text-emerald-800">
              <CheckCircle2 size={20} />
              <p className="text-sm font-bold">
                {completionNote || "Work order completed — detailed maintenance report not on file for this record."}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: ASSIGNEE & METRICS */}
        <div className="space-y-6">
          
          {/* Technician Card */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <HardHat size={16}/> Assigned Specialist
            </h3>
            
            {data.assignee ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-1.5rem bg-[#003366] text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-blue-900/20">
                    {data.assignee.fname?.[0]}{data.assignee.lname?.[0]}
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-900 leading-tight">
                      {data.assignee.fname} {data.assignee.lname}
                    </p>
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Field Technician</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <a href={`tel:${data.assignee.phone}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 hover:bg-blue-50 transition-all">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><Phone size={14} className="text-blue-500" /></div>
                    <span className="text-xs font-bold">{data.assignee.phone || "No phone linked"}</span>
                  </a>
                  <a href={`mailto:${data.assignee.email}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 hover:bg-blue-50 transition-all truncate">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><Mail size={14} className="text-blue-500" /></div>
                    <span className="text-xs font-bold truncate">{data.assignee.email || "No email linked"}</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-300">
                  <AlertCircle size={24}/>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase">Unassigned Work Order</p>
              </div>
            )}
          </div>

          {/* Requester Card */}
          {data.request?.requester && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <FileText size={16}/> Requester Info
              </h3>
              <div className="space-y-3">
                <p className="text-base font-black text-slate-900">
                  {data.request.requester.fname} {data.request.requester.lname}
                </p>
                <a href={`tel:${data.request.requester.phone ?? ""}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 hover:bg-blue-50 transition-all">
                  <div className="p-2 bg-white rounded-xl shadow-sm"><Phone size={14} className="text-blue-500" /></div>
                  <span className="text-xs font-bold">{data.request.requester.phone || "No phone linked"}</span>
                </a>
                <a href={`mailto:${data.request.requester.email ?? ""}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 hover:bg-blue-50 transition-all truncate">
                  <div className="p-2 bg-white rounded-xl shadow-sm"><Mail size={14} className="text-blue-500" /></div>
                  <span className="text-xs font-bold truncate">{data.request.requester.email || "No email linked"}</span>
                </a>
              </div>
            </div>
          )}

          {/* Timeline / Dates */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Calendar size={16}/> Schedule
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase">Due Date</span>
                <span className="text-sm font-bold text-slate-700">{data.request?.due_date ? new Date(data.request.due_date).toLocaleDateString() : "Not Set"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase">Expected Category</span>
                <span className="text-sm font-bold text-slate-700">{data.request?.category?.name || "General"}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {reassignOpen && (
        <div className="fixed inset-0 z-[1300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setReassignOpen(false)}>
          <div className="w-full max-w-2xl rounded-[2rem] bg-white border border-slate-100 p-6 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Reassign Work Order</h3>
              <button onClick={() => setReassignOpen(false)} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
                <ChevronLeft size={16} />
              </button>
            </div>

            <select
              value={selectedTechId}
              onChange={(e) => setSelectedTechId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900"
            >
              <option value="">Select technician</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {`${tech.fname ?? ""} ${tech.lname ?? ""}`.trim() || `Technician #${tech.id}`}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Priority</p>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due Date</p>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</p>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Finish Date</p>
                <input type="date" value={finishDate} onChange={(e) => setFinishDate(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled Time</p>
              <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-900" />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setReassignOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase">Cancel</button>
              <button onClick={() => void reassignWorkOrder()} disabled={reassigning || !selectedTechId} className="px-4 py-2 rounded-xl bg-[#003366] text-white text-xs font-black uppercase disabled:opacity-40">
                {reassigning ? "Reassigning..." : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
