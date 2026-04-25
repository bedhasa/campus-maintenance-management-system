"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, Clock, Filter, Info, Play, RefreshCw, Trash2 } from "lucide-react";

type Category = { id: number; name: string };
type Asset = { id: number; name: string };
type Technician = { id: number; fname: string; lname: string; open_workload?: number };

type Plan = {
  id: number;
  title: string;
  description?: string | null;
  status: "active" | "paused" | string;
  next_due_date: string;
  priority: "low" | "medium" | "high" | "urgent" | string;
  frequency_type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | string;
  frequency_interval: number;
  estimated_hours?: number | null;
  category_id?: number | null;
  asset_id?: number | null;
  assigned_technician_id?: number | null;
  category?: { id: number; name: string } | null;
  asset?: { id: number; name: string } | null;
  assignee?: { id: number; fname: string; lname: string } | null;
};

type PMLog = {
  id: number;
  performed_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  work_order?: {
    id: number;
    work_status: string;
    completed_at?: string | null;
    assignee?: { id: number; fname: string; lname: string } | null;
  } | null;
  workOrder?: {
    id: number;
    work_status: string;
    completed_at?: string | null;
    assignee?: { id: number; fname: string; lname: string } | null;
  } | null;
};

type PlanDetailResponse = {
  success: boolean;
  plan: Plan & { logs?: PMLog[] };
  history?: PMLog[];
  is_overdue?: boolean;
  overdue_days?: number;
};

type FormState = {
  title: string;
  description: string;
  category_id: string;
  asset_id: string;
  frequency_type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  frequency_interval: string;
  next_due_date: string;
  priority: "low" | "medium" | "high" | "urgent";
  estimated_hours: string;
  assigned_technician_id: string;
  status: "active" | "paused";
};

const emptyForm: FormState = {
  title: "",
  description: "",
  category_id: "",
  asset_id: "",
  frequency_type: "monthly",
  frequency_interval: "1",
  next_due_date: "",
  priority: "medium",
  estimated_hours: "",
  assigned_technician_id: "",
  status: "active",
};

interface PreventiveMaintenancePageProps {
  embedded?: boolean;
}

export default function PreventiveMaintenancePage({ embedded = false }: PreventiveMaintenancePageProps) {
  const [sectionTab, setSectionTab] = useState<"schedules" | "form" | "history">("schedules");
  const params = useSearchParams();
  const filterType = params?.get("filter");
  const selectedFromQuery = params?.get("plan");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<PlanDetailResponse | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const inputStyle =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none";
  const labelStyle = "mb-1.5 block text-xs font-semibold text-slate-700";

  const loadMeta = useCallback(async () => {
    const [categoryRes, assetRes, techRes] = await Promise.all([
      apiRequest<{ success: boolean; categories: Category[] }>("/api/requester/meta/categories", { method: "GET" }, true),
      apiRequest<{ success: boolean; assets: Asset[] }>("/api/requester/meta/assets", { method: "GET" }, true),
      apiRequest<{ success: boolean; technicians: Technician[] }>("/api/pm/technicians", { method: "GET" }, true),
    ]);

    setCategories(categoryRes.categories ?? []);
    setAssets(assetRes.assets ?? []);
    setTechnicians(techRes.technicians ?? []);
  }, []);

  const loadPlans = useCallback(async () => {
    const data = await apiRequest<{ success: boolean; plans: { data: Plan[] } }>("/api/pm/plans", { method: "GET" }, true);
    setPlans(data.plans.data ?? []);
  }, []);

  const loadPlanDetail = useCallback(async (id: number) => {
    const data = await apiRequest<PlanDetailResponse>(`/api/pm/plans/${id}`, { method: "GET" }, true);
    setSelectedDetail(data);
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

  useEffect(() => {
    if (!selectedFromQuery) return;
    const parsed = Number(selectedFromQuery);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setSelectedPlanId(parsed);
    void loadPlanDetail(parsed).catch(() => undefined);
  }, [loadPlanDetail, selectedFromQuery]);

  const visiblePlans = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekAhead = new Date(start);
    weekAhead.setDate(weekAhead.getDate() + 7);

    return plans.filter((plan) => {
      const due = new Date(plan.next_due_date);
      const overdue = plan.status === "active" && due < start;
      if (filterType === "overdue") return overdue;
      if (filterType === "upcoming") return due >= start && due <= weekAhead;
      return true;
    });
  }, [filterType, plans]);

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setForm({
      title: plan.title ?? "",
      description: plan.description ?? "",
      category_id: plan.category_id ? String(plan.category_id) : "",
      asset_id: plan.asset_id ? String(plan.asset_id) : "",
      frequency_type: (plan.frequency_type as FormState["frequency_type"]) ?? "monthly",
      frequency_interval: String(plan.frequency_interval ?? 1),
      next_due_date: plan.next_due_date ? String(plan.next_due_date).slice(0, 10) : "",
      priority: (plan.priority as FormState["priority"]) ?? "medium",
      estimated_hours: plan.estimated_hours ? String(plan.estimated_hours) : "",
      assigned_technician_id: plan.assigned_technician_id ? String(plan.assigned_technician_id) : "",
      status: plan.status === "paused" ? "paused" : "active",
    });
    setError(null);
    setSuccess(null);
  };

  const clearForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSectionTab("form");
  };

  const buildPayload = () => {
    const estimated = form.estimated_hours.trim() ? Number(form.estimated_hours) : null;
    const interval = form.frequency_interval.trim() ? Number(form.frequency_interval) : 1;

    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category_id: Number(form.category_id),
      asset_id: form.asset_id ? Number(form.asset_id) : null,
      frequency_type: form.frequency_type,
      frequency_interval: interval,
      next_due_date: form.next_due_date,
      priority: form.priority,
      estimated_hours: Number.isFinite(estimated) ? estimated : null,
      assigned_technician_id: form.assigned_technician_id ? Number(form.assigned_technician_id) : null,
      status: form.status,
    };
  };

  const savePlan = async () => {
    if (!form.title.trim() || !form.category_id || !form.next_due_date) {
      setError("Title, category, and next due date are required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = buildPayload();
      if (editingId) {
        await apiRequest(`/api/pm/plans/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true);
        setSuccess("Plan updated.");
      } else {
        await apiRequest("/api/pm/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }, true);
        setSuccess("Plan created.");
      }

      await loadPlans();
      clearForm();
      if (selectedPlanId) {
        await loadPlanDetail(selectedPlanId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan.");
    } finally {
      setIsSaving(false);
    }
  };

  const deletePlan = async (planId: number) => {
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/pm/plans/${planId}`, { method: "DELETE" }, true);
      setSuccess("Plan deleted.");
      await loadPlans();
      if (selectedPlanId === planId) {
        setSelectedPlanId(null);
        setSelectedDetail(null);
      }
      if (editingId === planId) {
        clearForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan.");
    }
  };

  const triggerDue = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    try {
      await apiRequest("/api/pm/trigger-due", { method: "POST" }, true);
      await loadPlans();
      if (selectedPlanId) {
        await loadPlanDetail(selectedPlanId);
      }
      setSuccess("Due plans processed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger due plans.");
    } finally {
      setIsSyncing(false);
    }
  }, [loadPlanDetail, loadPlans, selectedPlanId]);

  useEffect(() => {
    if (!embedded) return;

    const runTrigger = () => {
      void triggerDue();
    };

    window.addEventListener("pm-trigger-due-requested", runTrigger);
    return () => window.removeEventListener("pm-trigger-due-requested", runTrigger);
  }, [embedded, triggerDue]);

  const selectPlan = async (planId: number) => {
    setSelectedPlanId(planId);
    setSectionTab("history");
    setError(null);
    try {
      await loadPlanDetail(planId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plan history.");
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
            <button
              type="button"
              onClick={triggerDue}
              disabled={isSyncing}
              className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 disabled:opacity-50"
            >
              <Play size={16} fill="currentColor" />
              {isSyncing ? "Syncing..." : "Run Scheduler"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {[
            { id: "schedules", label: "Active Plans" },
            { id: "form", label: editingId ? "Edit Plan" : "New Plan" },
            { id: "history", label: "History Log" },
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
            { label: "Upcoming", value: "upcoming", icon: Clock },
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
                Create your first plan
              </button>
            </div>
          ) : (
            visiblePlans.map((plan) => {
              const due = new Date(plan.next_due_date);
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
                        <p className="text-xs font-bold uppercase tracking-tight text-slate-500">{plan.asset?.name || "General Facility"}</p>
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
                      <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-400">Next Service</p>
                      <p className={`font-semibold ${isOverdue ? "text-red-600" : "text-slate-700"}`}>
                        {new Date(plan.next_due_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[10px] font-bold uppercase text-slate-400">Frequency</p>
                      <p className="font-semibold capitalize text-slate-700">
                        {plan.frequency_type} (x{plan.frequency_interval})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                    <button type="button" onClick={() => void selectPlan(plan.id)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                      View History <ChevronRight size={14} />
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          startEdit(plan);
                          setSectionTab("form");
                        }}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePlan(plan.id)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
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
            <h2 className="text-xl font-bold text-slate-900">{editingId ? "Update Schedule" : "New Maintenance Plan"}</h2>
            <p className="text-sm text-slate-500">Define the recurrence and scope for this preventive task.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className={labelStyle}>Task Title</label>
              <input
                className={inputStyle}
                placeholder="e.g. Monthly AC Filter Change"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <label className={labelStyle}>Description</label>
              <textarea
                className={inputStyle}
                rows={3}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelStyle}>Category</label>
                <select className={inputStyle} value={form.category_id} onChange={(e) => setForm((prev) => ({ ...prev, category_id: e.target.value }))}>
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelStyle}>Related Asset</label>
                <select className={inputStyle} value={form.asset_id} onChange={(e) => setForm((prev) => ({ ...prev, asset_id: e.target.value }))}>
                  <option value="">No specific asset</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={String(asset.id)}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelStyle}>Frequency</label>
                  <select
                    className={inputStyle}
                    value={form.frequency_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, frequency_type: e.target.value as FormState["frequency_type"] }))}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className={labelStyle}>Interval</label>
                  <input
                    className={inputStyle}
                    type="number"
                    min={1}
                    value={form.frequency_interval}
                    onChange={(e) => setForm((prev) => ({ ...prev, frequency_interval: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={labelStyle}>Start Date</label>
                  <input
                    className={inputStyle}
                    type="date"
                    value={form.next_due_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, next_due_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                <label className={labelStyle}>Technician</label>
                <select
                  className={inputStyle}
                  value={form.assigned_technician_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, assigned_technician_id: e.target.value }))}
                >
                  <option value="">Optional assignee</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={String(technician.id)}>
                      {technician.fname} {technician.lname}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelStyle}>Estimated Hours</label>
                <input
                  className={inputStyle}
                  type="number"
                  step="0.25"
                  min={0.25}
                  value={form.estimated_hours}
                  onChange={(e) => setForm((prev) => ({ ...prev, estimated_hours: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                disabled={isSaving}
                onClick={savePlan}
                className="flex-1 rounded-xl bg-blue-700 py-3 font-bold text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-800 disabled:opacity-50"
              >
                {isSaving ? "Processing..." : editingId ? "Save Changes" : "Create Schedule"}
              </button>
              {editingId && (
                <button type="button" onClick={clearForm} className="rounded-xl border border-slate-300 px-6 py-3 font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className={sectionTab === "history" ? "mx-auto max-w-4xl" : "hidden"}>
          {!selectedPlanId || !selectedDetail ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
              <CalendarClock className="mx-auto mb-3 text-slate-300" size={40} />
              <p className="text-slate-500">Select a plan from the list to see its service history.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedDetail.plan.title}</h2>
                  <p className="text-sm text-slate-500">Service Logs & Work Orders</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-slate-400">Total Logs</p>
                  <p className="text-xl font-bold text-blue-600">{(selectedDetail.history ?? selectedDetail.plan.logs ?? []).length}</p>
                </div>
              </div>

              <div className="relative space-y-3 before:absolute before:inset-y-0 before:left-6 before:w-0.5 before:bg-slate-100">
                {(selectedDetail.history ?? selectedDetail.plan.logs ?? []).map((log) => {
                  const workOrder = log.work_order ?? log.workOrder;
                  return (
                    <div key={log.id} className="relative pl-12">
                      <div className="absolute left-[18px] top-4 h-3 w-3 rounded-full border-4 border-white bg-blue-500 shadow-sm" />
                      <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-200">
                        <div className="mb-2 flex items-start justify-between">
                          <p className="text-xs font-bold text-slate-400">{log.created_at ? new Date(log.created_at).toLocaleDateString() : "-"}</p>
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                            {workOrder?.work_status || "Completed"}
                          </span>
                        </div>
                        <p className="mb-2 text-sm font-medium text-slate-700">{log.notes || "Preventive maintenance completed as scheduled."}</p>
                        <div className="flex gap-4 border-t border-slate-50 pt-2 text-[11px] text-slate-500">
                          <span>WO #{workOrder?.id || "N/A"}</span>
                          <span>Tech: {workOrder?.assignee ? `${workOrder.assignee.fname} ${workOrder.assignee.lname}` : "System"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
