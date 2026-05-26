"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { buildStorageUrl } from "@/lib/runtime-config";
import {
  CalendarClock, CheckCircle, Clock, AlertTriangle, ChevronRight,
  X, UploadCloud, Wrench, Info, Package,
} from "lucide-react";

type PMTask = {
  id: number;
  asset_id: number;
  asset?: { id: number; name: string; image_path?: string | null; serial_number?: string | null; status?: string };
  title: string;
  description: string;
  frequency: string;
  scheduled_date: string;
  priority: string;
  status: string;
  notes: string;
  checklists: { id: number; task_description: string; is_completed: boolean }[];
};

type KpiData = { upcoming: number; dueToday: number; overdue: number; completed: number };

type SparePartOption = {
  id: number; name: string; sku: string;
  quantity_available: number; unit_price: number | string;
};

type SelectedSparePart = { spare_part_id: string; quantity_used: string; unit_cost: string };

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-rose-100 text-rose-700 border-rose-200",
  high:   "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  low:    "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_STYLES: Record<string, string> = {
  completed:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  assigned:    "bg-indigo-100 text-indigo-700 border-indigo-200",
  scheduled:   "bg-amber-100 text-amber-700 border-amber-200",
};

const STATUS_DOT: Record<string, string> = {
  completed:   "bg-emerald-500",
  in_progress: "bg-blue-500",
  assigned:    "bg-indigo-500",
  scheduled:   "bg-amber-500",
};

function priorityStyle(p: string) { return PRIORITY_STYLES[p] ?? PRIORITY_STYLES.low; }
function statusStyle(s: string)   { return STATUS_STYLES[s]   ?? "bg-slate-100 text-slate-600 border-slate-200"; }
function statusDot(s: string)     { return STATUS_DOT[s]      ?? "bg-slate-400"; }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(task: PMTask) {
  if (task.status === "completed") return false;
  return new Date(task.scheduled_date) < new Date(new Date().toDateString());
}

export default function PMDashboardPage() {
  const [tasks, setTasks] = useState<PMTask[]>([]);
  const [kpi, setKpi] = useState<KpiData>({ upcoming: 0, dueToday: 0, overdue: 0, completed: 0 });
  const [selectedTask, setSelectedTask] = useState<PMTask | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "checklist">("details");
  const [showReportForm, setShowReportForm] = useState(false);
  const [spareParts, setSpareParts] = useState<SparePartOption[]>([]);
  const [selectedSpareParts, setSelectedSpareParts] = useState<SelectedSparePart[]>([
    { spare_part_id: "", quantity_used: "1", unit_cost: "" },
  ]);
  const [reportForm, setReportForm] = useState({
    condition_before: "", work_performed: "", parts_used: "", recommendations: "", completion_notes: "",
  });
  const [beforeImage, setBeforeImage] = useState<File | null>(null);
  const [afterImage, setAfterImage]   = useState<File | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; tasks: PMTask[]; kpi: KpiData }>(
        "/api/technician/custom-pm", { method: "GET" }, true
      );
      if (res.success) { setTasks(res.tasks); setKpi(res.kpi); }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const loadSpareParts = async () => {
    try {
      const res = await apiRequest<{ success: boolean; spare_parts: SparePartOption[] }>(
        "/api/technician/spare-parts", { method: "GET" }, true
      );
      if (res.success) setSpareParts(res.spare_parts || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchData(); loadSpareParts(); }, []);

  const openTaskDetail = async (task: PMTask) => {
    setActiveTab("details");
    try {
      const res = await apiRequest<{ success: boolean; task: PMTask }>(
        `/api/technician/custom-pm/${task.id}`, { method: "GET" }, true
      );
      setSelectedTask(res.task);
    } catch (e) { console.error(e); }
  };

  const acceptTask = async () => {
    if (!selectedTask) return;
    try {
      const res = await apiRequest<{ success: boolean; task: PMTask }>(
        `/api/technician/custom-pm/${selectedTask.id}/accept`, { method: "PATCH" }, true
      );
      setSelectedTask(res.task);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const toggleChecklist = async (checklistId: number, isCompleted: boolean) => {
    if (!selectedTask) return;
    try {
      await apiRequest(`/api/technician/custom-pm/${selectedTask.id}/checklist/${checklistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: isCompleted }),
      }, true);
      const res = await apiRequest<{ success: boolean; task: PMTask }>(
        `/api/technician/custom-pm/${selectedTask.id}`, { method: "GET" }, true
      );
      setSelectedTask(res.task);
    } catch (e) { console.error(e); }
  };

  const handleOpenReportForm = () => {
    setSelectedSpareParts([{ spare_part_id: "", quantity_used: "1", unit_cost: "" }]);
    setReportForm({ condition_before: "", work_performed: "", parts_used: "", recommendations: "", completion_notes: "" });
    setBeforeImage(null); setAfterImage(null);
    setShowReportForm(true);
  };

  const addSparePartRow    = () => setSelectedSpareParts(p => [...p, { spare_part_id: "", quantity_used: "1", unit_cost: "" }]);
  const removeSparePartRow = (i: number) => setSelectedSpareParts(p => p.filter((_, idx) => idx !== i));
  const updateSparePartRow = (i: number, key: keyof SelectedSparePart, val: string) =>
    setSelectedSpareParts(p => p.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const formatMoney = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    setIsSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(reportForm).forEach(([k, v]) => fd.append(k, v));
      selectedSpareParts.filter(p => p.spare_part_id !== "").forEach((part, i) => {
        fd.append(`spare_parts[${i}][spare_part_id]`, part.spare_part_id);
        fd.append(`spare_parts[${i}][quantity_used]`, part.quantity_used);
        if (part.unit_cost.trim()) fd.append(`spare_parts[${i}][unit_cost]`, part.unit_cost);
      });
      if (beforeImage) fd.append("before_image", beforeImage);
      if (afterImage)  fd.append("after_image", afterImage);
      await apiRequest(`/api/technician/custom-pm/${selectedTask.id}/complete`, { method: "POST", body: fd }, true);
      setShowReportForm(false); setSelectedTask(null); fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to submit report");
    } finally { setIsSubmitting(false); }
  };

  const filteredTasks = filterStatus === "all" ? tasks : tasks.filter(t => t.status === filterStatus);
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const checklistProgress = selectedTask
    ? { done: selectedTask.checklists.filter(c => c.is_completed).length, total: selectedTask.checklists.length }
    : { done: 0, total: 0 };

  if (isLoading) {
    return (
      <div className="space-y-4 pb-28">
        <div className="h-8 w-48 bg-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28 max-w-2xl mx-auto px-1">

      {/* Header */}
      <div className="px-1 pt-2">
        <h1 className="text-2xl font-bold text-slate-900">PM Tasks</h1>
        <p className="text-sm text-slate-500">Your preventive maintenance schedule</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Upcoming",  value: kpi.upcoming,  icon: CalendarClock, color: "text-blue-600",    bg: "bg-blue-50" },
          { label: "Due Today", value: kpi.dueToday,  icon: Clock,         color: "text-orange-600",  bg: "bg-orange-50" },
          { label: "Overdue",   value: kpi.overdue,   icon: AlertTriangle, color: "text-rose-600",    bg: "bg-rose-50" },
          { label: "Completed", value: kpi.completed, icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</p>
              <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-600">Overall Progress</span>
            <span className="text-xs font-bold text-slate-400">{completedCount}/{tasks.length} completed</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { label: "All",         value: "all" },
          { label: "Assigned",    value: "assigned" },
          { label: "In Progress", value: "in_progress" },
          { label: "Scheduled",   value: "scheduled" },
          { label: "Completed",   value: "completed" },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilterStatus(opt.value)}
            className={`shrink-0 px-4 py-2 rounded-xl text-[11px] font-bold transition-all border ${
              filterStatus === opt.value
                ? "bg-[#003366] text-white border-[#003366]"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-100 p-10 text-center">
            <p className="text-sm text-slate-400">No tasks found.</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => openTaskDetail(task)}
              className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-4 hover:border-slate-200 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                {task.asset?.image_path ? (
                  <img src={buildStorageUrl(task.asset.image_path) ?? ""} alt={task.asset.name} className="w-full h-full object-cover" />
                ) : (
                  <Wrench size={20} className="text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(task.status)}`} />
                  <p className="text-sm font-bold text-slate-900 truncate">{task.title}</p>
                </div>
                <p className="text-xs text-slate-500 truncate">{task.asset?.name ?? "No asset"}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${priorityStyle(task.priority)}`}>
                    {task.priority}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${statusStyle(task.status)}`}>
                    {task.status.replace("_", " ")}
                  </span>
                  {isOverdue(task) && (
                    <span className="px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide bg-rose-50 text-rose-600 border-rose-200">
                      Overdue
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 font-medium ml-auto">{formatDate(task.scheduled_date)}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
            </button>
          ))
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && !showReportForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Locked Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-900 truncate pr-4">{selectedTask.title}</h2>
              <button type="button" onClick={() => setSelectedTask(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="flex gap-1 px-6 pt-3 shrink-0">
              {(["details", "checklist"] as const).map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-xl text-[11px] font-bold capitalize transition-all ${
                    activeTab === tab ? "bg-[#003366] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Scrollable Context Box */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {activeTab === "details" ? (
                <>
                  {selectedTask.asset && (
                    <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {selectedTask.asset.image_path
                          ? <img src={buildStorageUrl(selectedTask.asset.image_path) ?? ""} alt={selectedTask.asset.name} className="w-full h-full object-cover" />
                          : <Package size={20} className="text-slate-400" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{selectedTask.asset.name}</p>
                        {selectedTask.asset.serial_number && <p className="text-xs text-slate-500">S/N: {selectedTask.asset.serial_number}</p>}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${priorityStyle(selectedTask.priority)}`}>{selectedTask.priority}</span>
                    <span className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${statusStyle(selectedTask.status)}`}>{selectedTask.status.replace("_", " ")}</span>
                    <span className="px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide bg-slate-50 text-slate-600 border-slate-200">{selectedTask.frequency}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Description</p>
                    <p className="text-sm text-slate-700">{selectedTask.description || "No description provided."}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Info size={14} className="text-slate-400" />
                    <span>Scheduled: <strong>{formatDate(selectedTask.scheduled_date)}</strong></span>
                  </div>
                  {selectedTask.notes && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                      <p className="text-sm text-slate-700">{selectedTask.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {checklistProgress.total > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-600">{checklistProgress.done}/{checklistProgress.total} tasks done</span>
                        <span className="text-xs text-slate-400">{Math.round((checklistProgress.done / checklistProgress.total) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${(checklistProgress.done / checklistProgress.total) * 100}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {selectedTask.checklists.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No checklist items.</p>
                    ) : (
                      selectedTask.checklists.map((item) => (
                        <button key={item.id} type="button" onClick={() => toggleChecklist(item.id, !item.is_completed)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                            item.is_completed ? "bg-emerald-50 border-emerald-100" : "bg-white border-slate-100 hover:border-slate-200"
                          }`}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            item.is_completed ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                          }`}>
                            {item.is_completed && <CheckCircle size={12} className="text-white" />}
                          </div>
                          <span className={`text-sm ${item.is_completed ? "line-through text-slate-400" : "text-slate-700 font-medium"}`}>
                            {item.task_description}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Locked Action Footer */}
            <div className="px-6 pb-6 pt-3 border-t border-slate-100 space-y-2 shrink-0">
              {selectedTask.status === "assigned" && (
                <button type="button" onClick={acceptTask}
                  className="w-full py-3.5 rounded-2xl bg-[#003366] text-white text-sm font-bold active:scale-[0.99] transition-transform">
                  Accept Task
                </button>
              )}
              {selectedTask.status === "in_progress" && (
                <button type="button" onClick={handleOpenReportForm}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white text-sm font-bold active:scale-[0.99] transition-transform">
                  Submit Completion Report
                </button>
              )}
              <button type="button" onClick={() => setSelectedTask(null)}
                className="w-full py-3 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Report Modal */}
      {showReportForm && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Locked Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-900">Completion Report</h2>
              <button type="button" onClick={() => setShowReportForm(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>

            {/* Form wrapped directly around scroll container */}
            <form onSubmit={submitReport} className="flex-1 flex flex-col overflow-hidden">
              {/* Form Scrollable Body */}
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                {(
                  [
                    { key: "condition_before", label: "Condition Before",  placeholder: "Describe the asset condition before work..." },
                    { key: "work_performed",   label: "Work Performed",    placeholder: "Describe what was done..." },
                    { key: "parts_used",       label: "Parts Used (text)", placeholder: "List any parts used..." },
                    { key: "recommendations",  label: "Recommendations",   placeholder: "Any follow-up recommendations..." },
                    { key: "completion_notes", label: "Completion Notes",  placeholder: "Final notes..." },
                  ] as const
                ).map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
                    <textarea rows={2} placeholder={placeholder} value={reportForm[key]}
                      onChange={(e) => setReportForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003366]/20 resize-none" />
                  </div>
                ))}

                {/* Spare parts section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spare Parts Used</label>
                    <button type="button" onClick={addSparePartRow} className="text-[10px] font-bold text-[#003366] hover:underline">+ Add Row</button>
                  </div>
                  {selectedSpareParts.map((row, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <select value={row.spare_part_id} onChange={(e) => updateSparePartRow(i, "spare_part_id", e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none">
                        <option value="">Select part</option>
                        {spareParts.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} ({sp.quantity_available} available) — {formatMoney(Number(sp.unit_price))}
                          </option>
                        ))}
                      </select>
                      <input type="number" min="1" placeholder="Qty" value={row.quantity_used}
                        onChange={(e) => updateSparePartRow(i, "quantity_used", e.target.value)}
                        className="w-16 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-800 focus:outline-none" />
                      <input type="number" min="0" step="0.01" placeholder="Cost" value={row.unit_cost}
                        onChange={(e) => updateSparePartRow(i, "unit_cost", e.target.value)}
                        className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-800 focus:outline-none" />
                      {selectedSpareParts.length > 1 && (
                        <button type="button" onClick={() => removeSparePartRow(i)} className="text-rose-400 hover:text-rose-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Image uploads */}
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { label: "Before Image", state: beforeImage, setter: setBeforeImage },
                      { label: "After Image",  state: afterImage,  setter: setAfterImage },
                    ] as const
                  ).map(({ label, state, setter }) => (
                    <div key={label}>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
                      <label className="flex flex-col items-center justify-center gap-1 h-20 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-300 transition-colors">
                        {state ? (
                          <span className="text-[10px] font-bold text-emerald-600 px-2 truncate w-full text-center">{state.name}</span>
                        ) : (
                          <>
                            <UploadCloud size={18} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400">Upload</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setter(e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Locked Submission Footer */}
              <div className="px-6 pb-6 pt-3 border-t border-slate-100 shrink-0 bg-white">
                <button type="submit" disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-60 active:scale-[0.99] transition-transform">
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}