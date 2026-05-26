"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { buildStorageUrl } from "@/lib/runtime-config";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Clock, Filter, Info, Play, RefreshCw, Trash2, Plus, X } from "lucide-react";

type Technician = { id: number; fname: string; lname: string; open_workload?: number };

type Plan = {
  id: number;
  asset_id: number;
  asset?: { id: number; name: string; image_path?: string | null; serial_number?: string | null };
  title: string;
  description?: string | null;
  status: string;
  scheduled_date: string;
  priority: string;
  frequency: string;
  assigned_technician_id?: number | null;
  assignee?: { id: number; fname: string; lname: string } | null;
};

type HistoryTask = {
  id: number;
  asset_id: number;
  asset?: { id: number; name: string; image_path?: string | null; serial_number?: string | null };
  title: string;
  description?: string | null;
  status: string;
  scheduled_date: string;
  priority: string;
  frequency: string;
  assigned_technician_id?: number | null;
  assignee?: { id: number; fname: string; lname: string } | null;
  updated_at: string;
  report?: {
    id: number;
    condition_before?: string | null;
    work_performed: string;
    parts_used?: string | null;
    recommendations?: string | null;
    completion_notes?: string | null;
    before_image_path?: string | null;
    after_image_path?: string | null;
    created_at: string;
  } | null;
};

type FormState = {
  asset_id: string;
  title: string;
  description: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  scheduled_date: string;
  priority: "low" | "medium" | "high" | "urgent";
  assigned_technician_id: string;
  checklists: string[];
};

const emptyForm: FormState = {
  asset_id: "",
  title: "",
  description: "",
  frequency: "monthly",
  scheduled_date: "",
  priority: "medium",
  assigned_technician_id: "",
  checklists: [""],
};

interface PreventiveMaintenancePageProps {
  embedded?: boolean;
}

export default function PreventiveMaintenancePage({ embedded = false }: PreventiveMaintenancePageProps) {
  const [sectionTab, setSectionTab] = useState<"schedules" | "form" | "history">("schedules");
  const params = useSearchParams();
  const filterType = params?.get("filter");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [history, setHistory] = useState<HistoryTask[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const [assets, setAssets] = useState<{ id: number; name: string; serial_number: string | null }[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const inputStyle =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none";
  const labelStyle = "mb-1.5 block text-xs font-semibold text-slate-700";

  const loadMeta = useCallback(async () => {
    const techRes = await apiRequest<{ success: boolean; technicians: Technician[] }>("/api/pm/technicians", { method: "GET" }, true);
    setTechnicians(techRes.technicians ?? []);

    try {
      const assetRes = await apiRequest<{ success: boolean; assets: { id: number; name: string; serial_number: string | null }[] }>("/api/supervisor/assets", { method: "GET" }, true);
      setAssets(assetRes.assets ?? []);
    } catch (e) {
      console.warn("Could not load assets", e);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    const data = await apiRequest<{ success: boolean; tasks: Plan[]; history: HistoryTask[] }>("/api/supervisor/custom-pm", { method: "GET" }, true);
    setPlans(data.tasks ?? []);
    setHistory(data.history ?? []);
  }, []);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([loadMeta(), loadPlans()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preventive maintenance data.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [loadMeta, loadPlans]);

  const togglePlanStatus = async (id: number) => {
    try {
      setError(null);
      setSuccess(null);
      await apiRequest(`/api/supervisor/custom-pm/${id}/toggle`, {
        method: "PATCH",
      }, true);
      setSuccess("Plan status updated successfully.");
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle plan status.");
    }
  };

  const deletePlan = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this preventive maintenance plan? This will stop future work order generation.")) {
      return;
    }
    try {
      setError(null);
      setSuccess(null);
      await apiRequest(`/api/supervisor/custom-pm/${id}`, {
        method: "DELETE",
      }, true);
      setSuccess("Plan deleted successfully.");
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan.");
    }
  };

  const visiblePlans = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const thirtyDaysAhead = new Date(start);
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    return plans.filter((plan) => {
      const due = new Date(plan.scheduled_date);
      const overdue = plan.status === "active" && due < start;
      if (filterType === "overdue") return overdue;
      // Upcoming: only active plans due within 30 days (not yet overdue)
      if (filterType === "upcoming") return plan.status === "active" && due >= start && due <= thirtyDaysAhead;
      return true;
    });
  }, [filterType, plans]);

  const clearForm = () => {
    setForm(emptyForm);
    setSectionTab("form");
  };

  const updateChecklist = (index: number, value: string) => {
    const newChecklists = [...form.checklists];
    newChecklists[index] = value;
    setForm((prev) => ({ ...prev, checklists: newChecklists }));
  };

  const addChecklist = () => {
    setForm((prev) => ({ ...prev, checklists: [...prev.checklists, ""] }));
  };

  const removeChecklist = (index: number) => {
    const newChecklists = form.checklists.filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, checklists: newChecklists }));
  };

  const buildPayload = () => {
    return {
      asset_id: Number(form.asset_id),
      title: form.title.trim(),
      description: form.description.trim() || null,
      frequency: form.frequency,
      scheduled_date: form.scheduled_date,
      priority: form.priority,
      assigned_technician_id: form.assigned_technician_id ? Number(form.assigned_technician_id) : null,
      checklists: form.checklists.filter((item) => item.trim() !== ""),
    };
  };

  const savePlan = async () => {
    if (!form.title.trim() || !form.asset_id || !form.scheduled_date || !form.assigned_technician_id) {
      setError("Title, asset, scheduled date, and technician are required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = buildPayload();
      await apiRequest("/api/supervisor/custom-pm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, true);
      setSuccess("PM Task created and assigned successfully.");

      await loadPlans();
      clearForm();
      setSectionTab("schedules");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`mx-auto max-w-7xl ${embedded ? "p-0" : "p-6"} space-y-8`}>
      {!embedded && (
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Preventive Maintenance</h1>
            <p className="text-sm text-slate-500">Manage recurring service schedules and track equipment reliability.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadPlans()}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {[
            { id: "schedules", label: "Active Plans" },
            { id: "history", label: `History (${history.length})` },
            { id: "form", label: "New PM Task" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSectionTab(tab.id as "schedules" | "form" | "history")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                sectionTab === tab.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {[
            { label: "All", value: null, icon: Filter },
            { label: "Overdue", value: "overdue", icon: AlertTriangle },
            { label: "Next 30 Days", value: "upcoming", icon: Clock },
          ].map((filter) => (
            <Link
              key={filter.label}
              href={filter.value ? `/supervisor/maintenance-center?tab=pm&filter=${filter.value}` : "/supervisor/maintenance-center?tab=pm"}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                filterType === filter.value
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <filter.icon size={14} />
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="min-h-[400px]">
        <div className={sectionTab === "schedules" ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : "hidden"}>
          {isLoading ? (
            <div className="col-span-full py-20 text-center text-slate-400">Loading schedules...</div>
          ) : visiblePlans.length === 0 ? (
            <div className="col-span-full rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
              <Info className="mx-auto mb-3 text-slate-300" size={40} />
              <p className="font-medium text-slate-500">No maintenance plans found for this filter.</p>
              <button type="button" onClick={clearForm} className="mt-4 text-sm font-bold text-blue-600">
                Create your first task
              </button>
            </div>
          ) : (
            visiblePlans.map((plan) => {
              const due = new Date(plan.scheduled_date);
              const isOverdue = plan.status === "active" && due < new Date();

              return (
                <div key={plan.id} className={`group relative rounded-2xl border bg-white p-5 transition-all hover:shadow-md ${isOverdue ? "border-red-200" : "border-slate-200"}`}>
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${isOverdue ? "bg-red-100 text-red-600" : "bg-blue-50 text-blue-600"}`}>
                        <CalendarClock size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 transition-colors group-hover:text-blue-700">{plan.title}</h3>
                        <p className="text-xs font-bold uppercase tracking-tight text-slate-500">{plan.asset?.name || "Unknown Asset"}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-black uppercase ${
                        plan.priority === "high" || plan.priority === "urgent"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {plan.priority}
                    </span>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-400">Scheduled Date</p>
                      <p className={`font-semibold ${isOverdue ? "text-red-600" : "text-slate-700"}`}>
                        {new Date(plan.scheduled_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-400">Frequency / Status</p>
                      <p className="font-semibold capitalize text-slate-700">
                        {plan.frequency} • {plan.status}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="text-xs text-slate-500">
                      Tech: {plan.assignee ? `${plan.assignee.fname} ${plan.assignee.lname}` : "N/A"}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => togglePlanStatus(plan.id)}
                        className={`rounded-lg px-3 py-1 text-xs font-bold transition-all border ${
                          plan.status === "active"
                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {plan.status === "active" ? "Pause" : "Resume"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePlan(plan.id)}
                        className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 transition-all hover:bg-red-100"
                        title="Delete Plan"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={sectionTab === "form" ? "mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm" : "hidden"}>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">New Preventive Maintenance Task</h2>
            <p className="text-sm text-slate-500">Define the task and checklist items for the technician.</p>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyle}>Asset</label>
                <select
                  className={inputStyle}
                  value={form.asset_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, asset_id: e.target.value }))}
                >
                  <option value="" disabled className="text-slate-500">Select Asset...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} {a.serial_number ? `(${a.serial_number})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelStyle}>Maintenance Title</label>
                <input
                  className={inputStyle}
                  placeholder="e.g. Monthly Inspection"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className={labelStyle}>Description</label>
              <textarea
                className={inputStyle}
                rows={2}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelStyle}>Frequency</label>
                  <select
                    className={inputStyle}
                    value={form.frequency}
                    onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value as FormState["frequency"] }))}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Scheduled Date</label>
                  <input
                    className={inputStyle}
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, scheduled_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyle}>Priority</label>
                <select className={inputStyle} value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as FormState["priority"] }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className={labelStyle}>Assign Technician</label>
                <select
                  className={inputStyle}
                  value={form.assigned_technician_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, assigned_technician_id: e.target.value }))}
                >
                  <option value="" disabled className="text-slate-500">Select Technician...</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={String(technician.id)}>
                      {technician.fname} {technician.lname}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="border-t border-slate-200 pt-4 mt-4">
              <label className="mb-2 block text-sm font-bold text-slate-800">Checklist Items</label>
              <div className="space-y-2">
                {form.checklists.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      className={inputStyle}
                      placeholder="Checklist task description..."
                      value={item}
                      onChange={(e) => updateChecklist(index, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeChecklist(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addChecklist}
                className="mt-3 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
              >
                <Plus size={16} /> Add Item
              </button>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                disabled={isSaving}
                onClick={savePlan}
                className="flex-1 rounded-xl bg-blue-700 py-3 font-bold text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-800 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Create Schedule & Assign"}
              </button>
              <button type="button" onClick={() => setSectionTab('schedules')} className="rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* ── History Tab ── */}
        <div className={sectionTab === "history" ? "space-y-4" : "hidden"}>
          {isLoading ? (
            <div className="py-20 text-center text-slate-400">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
              <CheckCircle2 className="mx-auto mb-3 text-slate-300" size={40} />
              <p className="font-medium text-slate-500">No completed PM tasks yet.</p>
            </div>
          ) : (
            history.map((task) => (
              <div key={task.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{task.title}</h3>
                      <p className="text-xs font-bold uppercase tracking-tight text-slate-500">
                        {task.asset?.name || "Unknown Asset"}
                        {task.asset?.serial_number ? ` · S/N: ${task.asset.serial_number}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-black uppercase text-emerald-700">
                      Completed
                    </span>
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-black uppercase ${
                        task.priority === "high" || task.priority === "urgent"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-400">Scheduled Date</p>
                      <p className="font-semibold text-slate-700">
                        {new Date(task.scheduled_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-400">Completed At</p>
                      <p className="font-semibold text-slate-700">
                        {new Date(task.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-400">Frequency</p>
                      <p className="font-semibold capitalize text-slate-700">{task.frequency}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-400">Technician</p>
                      <p className="font-semibold text-slate-700">
                        {task.assignee ? `${task.assignee.fname} ${task.assignee.lname}` : "N/A"}
                      </p>
                    </div>
                  </div>

                  {task.report && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Completion Report</p>

                      {task.report.work_performed && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Work Performed</p>
                          <p className="text-sm text-slate-700">{task.report.work_performed}</p>
                        </div>
                      )}

                      {task.report.condition_before && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Condition Before</p>
                          <p className="text-sm text-slate-700">{task.report.condition_before}</p>
                        </div>
                      )}

                      {task.report.parts_used && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Parts Used</p>
                          <p className="text-sm text-slate-700">{task.report.parts_used}</p>
                        </div>
                      )}

                      {task.report.recommendations && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Recommendations</p>
                          <p className="text-sm text-slate-700">{task.report.recommendations}</p>
                        </div>
                      )}

                      {task.report.completion_notes && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5">Notes</p>
                          <p className="text-sm text-slate-700">{task.report.completion_notes}</p>
                        </div>
                      )}

                      {/* Report Images */}
                      {(task.report.before_image_path || task.report.after_image_path) && (
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          {task.report.before_image_path && (
                            <div>
                              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Before</p>
                              <img
                                src={buildStorageUrl(task.report.before_image_path)}
                                alt="Before maintenance"
                                className="w-full h-36 object-cover rounded-lg border border-slate-200"
                              />
                            </div>
                          )}
                          {task.report.after_image_path && (
                            <div>
                              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">After</p>
                              <img
                                src={buildStorageUrl(task.report.after_image_path)}
                                alt="After maintenance"
                                className="w-full h-36 object-cover rounded-lg border border-slate-200"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
