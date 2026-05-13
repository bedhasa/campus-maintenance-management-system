"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  Clock3,
  XCircle,
  MapPin,
  PauseCircle,
  Phone,
  PlayCircle,
  ShieldAlert,
  Star,
  User,
  Wrench,
} from "lucide-react";
import PageSkeleton from "@/components/PageSkeleton";
import {
  TechnicianRequestSummary,
  TechnicianWorkOrder,
  formatDate,
  formatDateTime,
  getImageUrl,
  getPriorityLabel,
  getPriorityTone,
  getTaskLocation,
  getTechnicianLifecycleMeta,
} from "@/lib/technician-utils";

type SparePartOption = {
  id: number;
  name: string;
  part_code?: string | null;
  quantity_available?: number | null;
  unit_price?: number | string | null;
};

const PROBABLE_CAUSES = [
  "Electrical Failure",
  "Wear and Tear",
  "Overheating",
  "Loose Connection",
  "User Error",
  "Environmental Damage",
  "Poor Maintenance",
  "Component Aging",
  "Unknown",
] as const;

type SimilarCompletionCase = {
  work_order_id: number;
  previous_problem?: string | null;
  root_cause?: string | null;
  action_taken?: string | null;
  completed_at?: string | null;
  spare_parts?: Array<{
    name?: string;
    part_code?: string | null;
    quantity_used?: number;
  }>;
};

type SelectedSparePart = {
  spare_part_id: string;
  quantity_used: string;
  unit_cost: string;
};

type TechnicianProgressNote = {
  id: number;
  note: string;
  created_at?: string;
};

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

type WorkOrderDetail = TechnicianWorkOrder & {
  request?: (TechnicianRequestSummary & {
    requester?: { fname?: string; lname?: string; phone?: string | null } | null;
    images?: Array<{ id: number; image_path: string }>;
  }) | null;
  spare_parts?: Array<{
    id: number;
    quantity_used?: number;
    unit_price?: number | string | null;
    total_price?: number | string | null;
    spare_part?: {
      id?: number;
      name?: string;
      part_code?: string | null;
      quantity_available?: number | null;
    } | null;
  }>;
  technician_progress_notes?: TechnicianProgressNote[];
  technician_completion_report?: CompletionReport | null;
  similar_completion_cases?: SimilarCompletionCase[];
};

type CompletionSparePartItem = {
  id: number;
  quantity_used?: number;
  unit_price?: number | string | null;
  total_price?: number | string | null;
  spare_part?: {
    id?: number;
    name?: string;
    part_code?: string | null;
    quantity_available?: number | null;
  } | null;
};

type Props = {
  id: string;
};

type ToastState = {
  type: "error" | "success";
  message: string;
} | null;

type BusyAction = "start" | "pause" | "progress" | "delay" | "complete" | null;

const defaultSparePartRow = (): SelectedSparePart => ({
  spare_part_id: "",
  quantity_used: "1",
  unit_cost: "",
});

const completionDraftKey = (id: string) => `technician-work-order-draft:${id}`;

function formatMoney(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : Number(n);
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export default function WorkOrderDetailPage({ id }: Props) {
  const [data, setData] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  const [progressNote, setProgressNote] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [problemFound, setProblemFound] = useState("");
  const [probableCause, setProbableCause] = useState("");
  const [probableCauseCustom, setProbableCauseCustom] = useState("");
  const [diagnosticSteps, setDiagnosticSteps] = useState<string[]>([""]);
  const [actionTaken, setActionTaken] = useState("");
  const [downtimeHoursOverride, setDowntimeHoursOverride] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [spareParts, setSpareParts] = useState<SparePartOption[]>([]);
  const [selectedSpareParts, setSelectedSpareParts] = useState<SelectedSparePart[]>([
    defaultSparePartRow(),
  ]);
  const [showCompletionForm, setShowCompletionForm] = useState(false);

  const applyDraft = useCallback((workOrderId: string) => {
    if (typeof window === "undefined") return;

    const raw = window.localStorage.getItem(completionDraftKey(workOrderId));
    if (!raw) return;

    try {
      const draft = JSON.parse(raw) as {
        resolutionSummary?: string;
        whatFixed?: string;
        problemFound?: string;
        probableCause?: string;
        probableCauseCustom?: string;
        diagnosticSteps?: string[];
        actionTaken?: string;
        downtimeHoursOverride?: string;
        delayReason?: string;
        selectedSpareParts?: SelectedSparePart[];
        showCompletionForm?: boolean;
      };

      setResolutionSummary(draft.resolutionSummary ?? draft.whatFixed ?? "");
      setProblemFound(draft.problemFound ?? "");
      setProbableCause(draft.probableCause ?? "");
      setProbableCauseCustom(draft.probableCauseCustom ?? "");
      setDiagnosticSteps(
        draft.diagnosticSteps && draft.diagnosticSteps.length > 0 ? draft.diagnosticSteps : [""],
      );
      setActionTaken(draft.actionTaken ?? "");
      setDowntimeHoursOverride(draft.downtimeHoursOverride ?? "");
      setDelayReason(draft.delayReason ?? "");
      setSelectedSpareParts(
        draft.selectedSpareParts && draft.selectedSpareParts.length > 0
          ? draft.selectedSpareParts.map((r) => ({ ...r, unit_cost: r.unit_cost ?? "" }))
          : [defaultSparePartRow()],
      );
      setShowCompletionForm(Boolean(draft.showCompletionForm));
    } catch {
      window.localStorage.removeItem(completionDraftKey(workOrderId));
    }
  }, []);

  const statusLabel = useMemo(() => {
    return getTechnicianLifecycleMeta(data).label;
  }, [data]);

  const statusTone = useMemo(() => getTechnicianLifecycleMeta(data).tone, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!data || data.work_status === "completed") return;

    window.localStorage.setItem(
      completionDraftKey(String(data.id)),
      JSON.stringify({
        resolutionSummary,
        problemFound,
        probableCause,
        probableCauseCustom,
        diagnosticSteps,
        actionTaken,
        downtimeHoursOverride,
        delayReason,
        selectedSpareParts,
        showCompletionForm,
      }),
    );
  }, [
    actionTaken,
    data,
    delayReason,
    diagnosticSteps,
    downtimeHoursOverride,
    problemFound,
    probableCause,
    probableCauseCustom,
    resolutionSummary,
    selectedSpareParts,
    showCompletionForm,
  ]);

  const applyWorkOrder = useCallback((detail: WorkOrderDetail) => {
    setData(detail);
    setShowCompletionForm(detail.work_status === "completed");

    const report = detail.technician_completion_report;
    setResolutionSummary(
      report?.resolution_summary ?? report?.completion_note ?? detail.completion_note ?? "",
    );
    setProblemFound(report?.problem_found ?? detail.problem_found ?? "");
    setProbableCause(report?.probable_cause ?? "");
    setProbableCauseCustom(report?.probable_cause_custom ?? "");
    setDiagnosticSteps(
      report?.diagnostic_steps && report.diagnostic_steps.length > 0
        ? report.diagnostic_steps
        : [""],
    );
    setActionTaken(report?.action_taken ?? detail.action_taken ?? "");
    setDowntimeHoursOverride(
      report?.downtime_hours !== undefined && report?.downtime_hours !== null
        ? String(report.downtime_hours)
        : "",
    );
    setDelayReason(report?.delay_reason ?? detail.delay_reason ?? "");

    const reportSpareParts = report?.spare_parts?.map((item) => ({
      spare_part_id: item.spare_part?.id ? String(item.spare_part.id) : "",
      quantity_used: item.quantity_used ? String(item.quantity_used) : "1",
      unit_cost:
        item.unit_price !== undefined && item.unit_price !== null
          ? String(item.unit_price)
          : "",
    }));

    setSelectedSpareParts(
      reportSpareParts && reportSpareParts.length > 0 ? reportSpareParts : [defaultSparePartRow()],
    );
    if (detail.work_status === "completed") {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(completionDraftKey(String(detail.id)));
      }
      return;
    }

    applyDraft(String(detail.id));
  }, [applyDraft]);

  const optimisticStatusUpdate = useCallback((workStatus: WorkOrderDetail["work_status"]) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            work_status: workStatus,
            status_updated_at: new Date().toISOString(),
          }
        : prev,
    );
  }, []);

  const loadWorkOrder = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/technician/work-orders/${id}`,
        { method: "GET" },
        true,
      );

      applyWorkOrder(response.work_order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load work order.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [applyWorkOrder, id]);

  const loadSpareParts = useCallback(async () => {
    try {
      const parts = await apiRequest<{ success: boolean; spare_parts: SparePartOption[] }>(
        "/api/technician/spare-parts",
        { method: "GET" },
        true,
      );
      setSpareParts(parts.spare_parts ?? []);
    } catch {
      // Ignore catalog refresh failures so the page can still work with existing data.
    }
  }, []);

  useEffect(() => {
    void loadWorkOrder();
    void loadSpareParts();
  }, [loadSpareParts, loadWorkOrder]);

  useLiveRefresh(() => loadWorkOrder(true), { enabled: true, intervalMs: 7000 });

  const start = async () => {
    const wasPaused = data?.work_status === "paused";
    optimisticStatusUpdate("in_progress");
    try {
      setBusyAction("start");
      const response = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/technician/work-orders/${id}/start`,
        { method: "PATCH" },
        true,
      );
      applyWorkOrder(response.work_order);
      setToast({
        type: "success",
        message: wasPaused ? "Work order resumed." : "Work order started.",
      });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to update status." });
      void loadWorkOrder(true);
    } finally {
      setBusyAction(null);
    }
  };

  const decline = async () => {
    const reason = declineReason.trim();
    if (!reason) {
      setToast({ type: "error", message: "Decline reason is required." });
      return;
    }
    try {
      setBusyAction("start");
      await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/technician/work-orders/${id}/decline`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
        true,
      );
      setDeclineReason("");
      setToast({ type: "success", message: "Assignment declined and supervisor notified." });
      void loadWorkOrder(true);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to decline assignment." });
    } finally {
      setBusyAction(null);
    }
  };

  const pause = async () => {
    optimisticStatusUpdate("paused");
    try {
      setBusyAction("pause");
      const response = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/technician/work-orders/${id}/pause`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pause_reason: pauseReason.trim() || undefined }),
        },
        true,
      );
      applyWorkOrder(response.work_order);
      setPauseReason("");
      setToast({ type: "success", message: "Work order paused." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to pause work order." });
      void loadWorkOrder(true);
    } finally {
      setBusyAction(null);
    }
  };

  const saveProgressNote = async () => {
    const note = progressNote.trim();
    if (!note) {
      setToast({ type: "error", message: "Please add a reminder first." });
      return;
    }

    try {
      setBusyAction("progress");
      const response = await apiRequest<{
        success: boolean;
        data: TechnicianProgressNote;
      }>(
        `/api/technician/work-orders/${id}/progress-note`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: note }),
        },
        true,
      );

      setProgressNote("");
      setData((prev) =>
        prev
          ? {
              ...prev,
              technician_progress_notes: [...(prev.technician_progress_notes ?? []), response.data],
            }
          : prev,
      );
      setToast({ type: "success", message: "Reminder saved." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to save reminder." });
    } finally {
      setBusyAction(null);
    }
  };

  const updateSparePartRow = (index: number, field: keyof SelectedSparePart, value: string) => {
    setSelectedSpareParts((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, [field]: value };
        if (field === "spare_part_id") {
          const pid = Number(value);
          const catalog = spareParts.find((p) => p.id === pid);
          const price = catalog?.unit_price;
          if (price !== undefined && price !== null && price !== "") {
            next.unit_cost = String(price);
          }
        }
        return next;
      }),
    );
  };

  const addSparePartRow = () => {
    setSelectedSpareParts((prev) => [...prev, defaultSparePartRow()]);
  };

  const removeSparePartRow = (index: number) => {
    setSelectedSpareParts((prev) => {
      if (prev.length === 1) return [defaultSparePartRow()];
      return prev.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const complete = async () => {
    const summary = resolutionSummary.trim();
    const detectedProblem = problemFound.trim();
    const performedAction = actionTaken.trim();
    const steps = diagnosticSteps.map((s) => s.trim()).filter(Boolean);

    if (!summary || !detectedProblem || !performedAction || !probableCause) {
      setToast({
        type: "error",
        message: "Please complete resolution summary, problem found, root cause, and corrective actions.",
      });
      return;
    }

    if (steps.length === 0) {
      setToast({ type: "error", message: "Add at least one diagnostic step." });
      return;
    }

    try {
      setBusyAction("complete");

      const validSpareParts = selectedSpareParts
        .filter((row) => row.spare_part_id && Number(row.quantity_used) > 0)
        .map((row) => {
          const base: { spare_part_id: number; quantity_used: number; unit_cost?: number } = {
            spare_part_id: Number(row.spare_part_id),
            quantity_used: Number(row.quantity_used),
          };
          const uc = row.unit_cost.trim();
          if (uc !== "" && !Number.isNaN(Number(uc))) {
            base.unit_cost = Number(uc);
          }
          return base;
        });

      const formData = new FormData();
      formData.append("resolution_summary", summary);
      formData.append("completion_note", summary);
      formData.append("problem_found", detectedProblem);
      formData.append("probable_cause", probableCause);
      if (probableCauseCustom.trim()) {
        formData.append("probable_cause_custom", probableCauseCustom.trim());
      }
      formData.append("diagnostic_steps", JSON.stringify(steps));
      formData.append("action_taken", performedAction);
      if (downtimeHoursOverride.trim() !== "" && !Number.isNaN(Number(downtimeHoursOverride))) {
        formData.append("downtime_hours", String(Number(downtimeHoursOverride)));
      }
      if (delayReason.trim()) formData.append("delay_reason", delayReason.trim());

      imageFiles.forEach((file) => {
        formData.append("images[]", file);
      });

      validSpareParts.forEach((part, index) => {
        formData.append(`spare_parts[${index}][spare_part_id]`, String(part.spare_part_id));
        formData.append(`spare_parts[${index}][quantity_used]`, String(part.quantity_used));
        if (part.unit_cost !== undefined) {
          formData.append(`spare_parts[${index}][unit_cost]`, String(part.unit_cost));
        }
      });

      optimisticStatusUpdate("completed");
      const response = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/technician/work-orders/${id}/complete`,
        {
          method: "POST",
          body: formData,
        },
        true,
      );

      applyWorkOrder(response.work_order);
      setImageFiles([]);
      setShowCompletionForm(true);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(completionDraftKey(id));
      }
      setToast({ type: "success", message: "Maintenance completion report submitted." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to complete work order." });
    } finally {
      setBusyAction(null);
    }
  };

  const reportDelay = async () => {
    const reason = delayReason.trim();
    if (!reason) {
      setToast({ type: "error", message: "Please add a delay reason first." });
      return;
    }

    try {
      setBusyAction("delay");
      const response = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/technician/work-orders/${id}/delay`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delay_reason: reason }),
        },
        true,
      );
      applyWorkOrder(response.work_order);
      setToast({ type: "success", message: "Delay reason saved." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to save delay reason." });
    } finally {
      setBusyAction(null);
    }
  };

  const reportedProblemBlock = useMemo(() => {
    const title = data?.request?.title?.trim();
    const desc = data?.request?.description?.trim();
    if (!title && !desc) return "No reported problem description.";
    return [title, desc].filter(Boolean).join("\n\n");
  }, [data]);

  const computedDowntimePreview = useMemo(() => {
    if (!data) return null;
    const anchor = data.request?.created_at ?? data.created_at;
    if (!anchor) return null;
    const start = new Date(anchor).getTime();
    if (Number.isNaN(start)) return null;
    const hours = (Date.now() - start) / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
  }, [data]);

  const updateDiagnosticStep = (index: number, value: string) => {
    setDiagnosticSteps((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const addDiagnosticStep = () => setDiagnosticSteps((prev) => [...prev, ""]);

  const removeDiagnosticStep = (index: number) => {
    setDiagnosticSteps((prev) => (prev.length <= 1 ? [""] : prev.filter((_, i) => i !== index)));
  };

  if (loading) return <PageSkeleton cards={2} rows={4} />;

  if (!data) {
    return (
      <div className="p-10 text-center font-bold text-rose-500">
        {error || "Work order not found."}
      </div>
    );
  }

  const requesterName = `${data.request?.requester?.fname || "Unknown"} ${data.request?.requester?.lname || "Requester"}`.trim();
  const requestImages = data.request?.images ?? [];
  const reminders = data.technician_progress_notes ?? [];
  const completionReport = data.technician_completion_report;
  const hasRecordedCompletionReport = Boolean(completionReport);
  const submittedSpareParts: CompletionSparePartItem[] =
    completionReport?.spare_parts && completionReport.spare_parts.length > 0
      ? completionReport.spare_parts
      : data.spare_parts ?? [];
  const requestStatusLogs = data.request?.statusLogs ?? data.request?.status_logs ?? [];
  const latestReopenLog =
    requestStatusLogs.find(
      (log) => log.new_status === "assigned" && /reopen/i.test(log.comment ?? ""),
    ) ?? null;
  const latestReopenReason = latestReopenLog?.comment ?? null;
  const latestReopenActor = latestReopenLog?.changedBy
    ? `${latestReopenLog.changedBy.fname ?? ""} ${latestReopenLog.changedBy.lname ?? ""}`.trim()
    : "";

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pb-28 pt-4">
      <div className="flex items-center justify-between">
        <Link href="/technician/tasks" className="p-2 -ml-2 text-slate-500 transition-colors hover:text-slate-900">
          <ArrowLeft size={24} />
        </Link>
        <span className={`rounded-full border px-4 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone}`}>
          {statusLabel}
        </span>
      </div>

      {toast && (
        <div className="fixed left-1/2 top-6 z-[100] w-[90%] max-w-sm -translate-x-1/2">
          <div
            className={`rounded-2xl border px-5 py-4 text-center text-sm font-black shadow-2xl ${
              toast.type === "error"
                ? "border-rose-600 bg-rose-500 text-white"
                : "border-emerald-600 bg-emerald-500 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <section className="rounded-[2rem] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <h1 className="text-2xl font-black leading-tight text-slate-900">
              {data.request?.title || `Work Order #${data.id}`}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getPriorityTone(data.request?.priority)}`}>
                {getPriorityLabel(data.request?.priority)}
              </span>
              <span className={`rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone}`}>
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned On</p>
            <p className="text-sm font-bold text-slate-900">{formatDate(data.created_at)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <MapPin size={16} className="text-blue-600" />
              <p className="text-[10px] font-black uppercase tracking-widest">Location</p>
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900">{getTaskLocation(data)}</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar size={16} className="text-emerald-600" />
              <p className="text-[10px] font-black uppercase tracking-widest">Current Status</p>
            </div>
            <p className="mt-2 text-sm font-bold capitalize text-slate-900">{statusLabel}</p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] bg-[#003366] p-6 text-white shadow-xl">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Requester Info</p>
            <h2 className="text-xl font-black tracking-tight">{requesterName}</h2>
            <p className="font-mono text-sm text-blue-200">
              {data.request?.requester?.phone || "Phone hidden"}
            </p>
          </div>
          {data.request?.requester?.phone ? (
            <a
              href={`tel:${data.request.requester.phone}`}
              className="rounded-2xl border border-white/10 bg-white/10 p-4 transition-all active:bg-white/20"
            >
              <Phone size={24} fill="currentColor" className="text-white" />
            </a>
          ) : null}
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <User size={120} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Problem Description
        </h3>
        <p className="text-sm font-medium leading-relaxed text-slate-700">
          {data.request?.description || "No description provided."}
        </p>
      </section>

      {(data.similar_completion_cases?.length ?? 0) > 0 && (
        <section className="rounded-[2rem] border border-indigo-100 bg-indigo-50/80 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-indigo-800">
            <BookOpen size={18} />
            <h3 className="text-[10px] font-black uppercase tracking-widest">Similar Previous Cases</h3>
          </div>
          <p className="mb-4 text-xs font-medium text-indigo-900/80">
            Reference-only history for this asset, category, or matching keywords. Does not change this work order.
          </p>
          <div className="space-y-4">
            {data.similar_completion_cases?.map((c) => (
              <div
                key={`${c.work_order_id}-${c.completed_at ?? ""}`}
                className="rounded-2xl border border-indigo-100 bg-white p-4 text-sm text-slate-800 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <p className="font-black text-slate-900">WO #{c.work_order_id}</p>
                  {c.completed_at ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {formatDateTime(c.completed_at)}
                    </span>
                  ) : null}
                </div>
                <dl className="mt-3 space-y-2 text-xs sm:text-sm">
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
                  {c.spare_parts && c.spare_parts.length > 0 ? (
                    <div>
                      <dt className="font-black uppercase tracking-widest text-slate-400">Spare parts</dt>
                      <dd className="mt-1 text-slate-700">
                        {c.spare_parts.map((p) => (
                          <span key={`${p.name}-${p.quantity_used}`} className="mr-2 inline-block rounded-lg bg-slate-50 px-2 py-0.5">
                            {p.name}
                            {p.part_code ? ` (${p.part_code})` : ""} × {p.quantity_used ?? 0}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {latestReopenReason && data.work_status !== "completed" && (
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-700" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-700">
              Reopen Reason
            </h3>
          </div>
          <p className="text-sm font-medium leading-relaxed text-amber-950">{latestReopenReason}</p>
          {(latestReopenActor || latestReopenLog?.created_at) && (
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-amber-700/80">
              {latestReopenActor || "Requester"} {latestReopenLog?.created_at ? `• ${formatDateTime(latestReopenLog.created_at)}` : ""}
            </p>
          )}
        </section>
      )}

      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Work Order Actions
        </h3>

        {data.work_status === "assigned" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => void start()}
              disabled={busyAction === "start"}
              className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-[#003366] py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <PlayCircle size={20} />
              {busyAction === "start" ? "Accepting..." : "Accept Assignment"}
            </button>

            <div className="space-y-2 rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-rose-700">
                Decline Reason (required)
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Explain why you are declining this task."
                className="min-h-[90px] w-full rounded-2xl border border-rose-200 bg-white p-4 text-sm text-slate-900 outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => void decline()}
                disabled={busyAction === "start" || !declineReason.trim()}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-rose-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                <XCircle size={16} />
                Decline Assignment
              </button>
            </div>
          </div>
        )}

        {(data.work_status === "in_progress" || data.work_status === "paused") && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {data.work_status === "paused" ? (
                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={busyAction === "start"}
                  className="flex items-center justify-center gap-3 rounded-[1.5rem] bg-[#003366] py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <PlayCircle size={20} />
                  {busyAction === "start" ? "Resuming..." : "Resume Work Order"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void pause()}
                  disabled={busyAction === "pause"}
                  className="flex items-center justify-center gap-3 rounded-[1.5rem] bg-amber-500 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <PauseCircle size={20} />
                  {busyAction === "pause" ? "Pausing..." : "Pause Work Order"}
                </button>
              )}
            </div>

            {data.work_status === "in_progress" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Pause Reason
                </label>
                <textarea
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="Optional note for why the work order is paused."
                  className="min-h-[90px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none placeholder:text-slate-500"
                />
              </div>
            )}
          </div>
        )}

        {data.work_status === "completed" && (
          <div className={`rounded-2xl p-4 text-sm font-bold ${data.request?.status === "closed" ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-800"}`}>
            {data.request?.status === "closed"
              ? "This work order has been approved and closed."
              : "Completion was submitted. Waiting for requester approval and supervisor closure."}
          </div>
        )}
      </section>

      {(data.work_status === "in_progress" || data.work_status === "paused") && (
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-700" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-700">
              Delay Reason
            </h3>
          </div>

          <textarea
            value={delayReason}
            onChange={(e) => setDelayReason(e.target.value)}
            placeholder="Explain why the task is delayed."
            className="min-h-[90px] w-full rounded-2xl border border-amber-200 bg-white p-4 text-sm text-slate-900 outline-none placeholder:text-slate-500"
          />

          <button
            type="button"
            onClick={() => void reportDelay()}
            disabled={busyAction === "delay" || !delayReason.trim()}
            className="mt-3 w-full rounded-xl bg-amber-600 py-4 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {busyAction === "delay" ? "Saving..." : "Save Delay Reason"}
          </button>

          <button
            type="button"
            onClick={() => setShowCompletionForm(true)}
            disabled={busyAction === "complete"}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-emerald-600 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            Open Completion Report
          </button>
        </section>
      )}

      {(showCompletionForm || data.work_status === "completed") && (
        <section className="print-completion-report rounded-[2rem] border border-emerald-100 bg-white p-6 shadow-sm print:border-slate-300 print:shadow-none">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 print:border-slate-200">
            <div className="flex items-center gap-2">
              <Wrench size={18} className="text-emerald-600" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">CMMS</p>
                <h3 className="text-base font-black tracking-tight text-slate-900">
                  Maintenance Completion Report
                </h3>
              </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 print:text-slate-600">
              Work Order #{data.id}
            </p>
          </div>

          {data.work_status === "completed" ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800 print:bg-white print:text-slate-800">
                {data.request?.status === "closed"
                  ? "Closed work order — maintenance completion record below."
                  : "Submitted — awaiting requester verification and supervisor closure."}
              </div>

              {!hasRecordedCompletionReport ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900">
                  Completion report not recorded.
                </div>
              ) : (
                <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Reported Problem (original request)
                  </label>
                  <div className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 print:border-slate-200">
                    {completionReport?.issue_reported?.trim() || reportedProblemBlock}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Actual Problem Found
                  </label>
                  <div className="whitespace-pre-wrap min-h-[60px] rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 print:border-slate-200">
                    {problemFound || "—"}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Root Cause
                  </label>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-800 print:border-slate-200">
                    {[completionReport?.probable_cause, completionReport?.probable_cause_custom]
                      .filter(Boolean)
                      .join(" — ") || "—"}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Downtime (hours)
                  </label>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold text-slate-900 print:border-slate-200">
                    {completionReport?.downtime_hours !== undefined &&
                    completionReport?.downtime_hours !== null &&
                    completionReport?.downtime_hours !== ""
                      ? String(completionReport.downtime_hours)
                      : "—"}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Diagnostic Steps Taken
                  </label>
                  <ol className="list-decimal space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 pl-8 text-sm text-slate-700 print:border-slate-200">
                    {(completionReport?.diagnostic_steps?.length
                      ? completionReport.diagnostic_steps
                      : []
                    ).map((step, idx) => (
                      <li key={`${idx}-${step.slice(0, 12)}`}>{step}</li>
                    ))}
                    {!(completionReport?.diagnostic_steps && completionReport.diagnostic_steps.length) && (
                      <li className="text-slate-400">—</li>
                    )}
                  </ol>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Corrective Actions Taken
                  </label>
                  <div className="whitespace-pre-wrap min-h-[80px] rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 print:border-slate-200">
                    {actionTaken || "—"}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Resolution Summary
                  </label>
                  <div className="whitespace-pre-wrap rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm font-medium text-emerald-950 print:border-slate-200">
                    {resolutionSummary || completionReport?.resolution_summary || "—"}
                  </div>
                </div>
              </div>

              {delayReason ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Delay Reason
                  </label>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900 print:border-slate-200">
                    {delayReason}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Spare Parts Used
                </label>
                {submittedSpareParts.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 print:border-slate-300">
                    <table className="w-full min-w-[520px] border-collapse text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 print:bg-white">
                        <tr>
                          <th className="border-b border-slate-200 px-3 py-2">Part</th>
                          <th className="border-b border-slate-200 px-3 py-2">Qty</th>
                          <th className="border-b border-slate-200 px-3 py-2">Unit</th>
                          <th className="border-b border-slate-200 px-3 py-2">Line total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submittedSpareParts.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100">
                            <td className="px-3 py-2 font-bold text-slate-900">
                              {item.spare_part?.name || "—"}
                              <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
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
                        <tr className="bg-slate-50 font-black text-slate-900 print:bg-white">
                          <td colSpan={3} className="px-3 py-2 text-right text-[10px] uppercase tracking-widest">
                            Reported Total
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(
                              submittedSpareParts.reduce(
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
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Attachments
                </label>
                {(() => {
                  const raw = [
                    ...(completionReport?.attachment_paths ?? []),
                    ...(completionReport?.image_path &&
                    !(completionReport?.attachment_paths ?? []).includes(completionReport.image_path)
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
                          className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 print:border-slate-200"
                        >
                          <Image
                            src={getImageUrl(pth)}
                            alt="Completion attachment"
                            width={800}
                            height={360}
                            unoptimized
                            className="h-40 w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No images attached.</p>
                  );
                })()}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-widest text-slate-500 print:border-slate-200">
                <Clock3 size={14} />
                {completionReport?.submitted_at ? (
                  <span>Completed {formatDateTime(completionReport.submitted_at)}</span>
                ) : null}
                {completionReport?.technician ? (
                  <span className="text-slate-700">
                    Technician{" "}
                    <span className="font-black text-slate-900">
                      {completionReport.technician.fname} {completionReport.technician.lname}
                    </span>
                  </span>
                ) : null}
              </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step 1 — Context</p>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Reported Problem (read-only)
                </label>
                <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  {reportedProblemBlock}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step 2 — Findings</p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Actual Problem Found <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={problemFound}
                    onChange={(e) => setProblemFound(e.target.value)}
                    className="min-h-[100px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none placeholder:text-slate-500"
                    placeholder="Describe the real issue discovered after inspection."
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Probable / Root Cause <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={probableCause}
                      onChange={(e) => setProbableCause(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900"
                    >
                      <option value="">Select…</option>
                      {PROBABLE_CAUSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Custom detail (optional)
                    </label>
                    <input
                      type="text"
                      value={probableCauseCustom}
                      onChange={(e) => setProbableCauseCustom(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                      placeholder="Extra context for root cause"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Diagnostic Steps Taken <span className="text-rose-500">*</span>
                  </label>
                  {diagnosticSteps.map((step, index) => (
                    <div key={`diag-${index}`} className="flex gap-2">
                      <textarea
                        value={step}
                        onChange={(e) => updateDiagnosticStep(index, e.target.value)}
                        className="min-h-[52px] flex-1 rounded-2xl border border-slate-200 p-3 text-sm text-slate-900 outline-none"
                        placeholder={`Step ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeDiagnosticStep(index)}
                        className="shrink-0 rounded-xl px-2 text-rose-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addDiagnosticStep}
                    className="w-full rounded-2xl border border-dashed border-slate-200 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    + Add Step
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step 3 — Resolution</p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Corrective Actions Taken <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none"
                    placeholder="Describe exactly what was repaired or replaced."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Resolution Summary <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={resolutionSummary}
                    onChange={(e) => setResolutionSummary(e.target.value)}
                    className="min-h-[72px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none"
                    placeholder="Short executive summary of the repair."
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Downtime (hours)
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Suggested from request creation to now:{" "}
                      <span className="font-bold text-slate-700">
                        {computedDowntimePreview != null ? computedDowntimePreview : "—"}
                      </span>
                      . Override if needed.
                    </p>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={downtimeHoursOverride}
                      onChange={(e) => setDowntimeHoursOverride(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900"
                      placeholder={computedDowntimePreview != null ? String(computedDowntimePreview) : "Hours"}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step 4 — Parts & Evidence</p>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Spare Parts Used
                </label>
                {selectedSpareParts.map((item, index) => {
                  const qty = Number(item.quantity_used) || 0;
                  const unit =
                    item.unit_cost.trim() !== "" && !Number.isNaN(Number(item.unit_cost))
                      ? Number(item.unit_cost)
                      : item.spare_part_id
                        ? Number(
                            spareParts.find((p) => String(p.id) === item.spare_part_id)?.unit_price ?? NaN,
                          )
                        : NaN;
                  const lineTotal = !Number.isNaN(unit) ? unit * qty : 0;
                  return (
                    <div
                      key={`${index}-${item.spare_part_id}`}
                      className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_72px_96px_96px_auto]"
                    >
                      <select
                        value={item.spare_part_id}
                        onChange={(e) => updateSparePartRow(index, "spare_part_id", e.target.value)}
                        className="rounded-xl border-none bg-white px-3 py-2 text-xs font-bold text-slate-900"
                      >
                        <option value="">Select Part</option>
                        {spareParts.map((part) => (
                          <option key={part.id} value={String(part.id)}>
                            {part.name}
                            {typeof part.quantity_available === "number"
                              ? ` (Stock: ${part.quantity_available})`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity_used}
                        onChange={(e) => updateSparePartRow(index, "quantity_used", e.target.value)}
                        className="rounded-xl border-none bg-white px-2 py-2 text-center text-xs font-black text-slate-900"
                        title="Qty"
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unit_cost}
                        onChange={(e) => updateSparePartRow(index, "unit_cost", e.target.value)}
                        className="rounded-xl border-none bg-white px-2 py-2 text-center text-xs font-bold text-slate-900"
                        title="Unit cost"
                        placeholder="Unit"
                      />
                      <div className="flex items-center justify-end text-xs font-black text-slate-700">
                        {formatMoney(lineTotal)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSparePartRow(index)}
                        className="text-rose-500 sm:text-left"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addSparePartRow}
                  className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  + Add Spare Part
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Photo attachments (optional)
                </label>
                <label className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600">
                  <div className="flex items-center gap-3">
                    <Camera size={18} className="shrink-0 text-slate-400" />
                    <span className="flex-1">Select one or more images</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))}
                  />
                  {imageFiles.length > 0 ? (
                    <ul className="text-xs text-slate-500">
                      {imageFiles.map((f) => (
                        <li key={f.name}>{f.name}</li>
                      ))}
                    </ul>
                  ) : null}
                </label>
              </div>

              <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void complete()}
                  disabled={
                    busyAction === "complete" ||
                    !resolutionSummary.trim() ||
                    !problemFound.trim() ||
                    !actionTaken.trim() ||
                    !probableCause
                  }
                  className="w-full rounded-2xl bg-emerald-600 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-emerald-600/20 disabled:opacity-50"
                >
                  {busyAction === "complete" ? "Submitting..." : "Submit Maintenance Report"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCompletionForm(false)}
                  disabled={busyAction === "complete"}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 disabled:opacity-50"
                >
                  Close Form
                </button>
              </div>
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Draft saves automatically on this device.
              </p>
            </div>
          )}
        </section>
      )}

      {data.request?.rating && (
        <section className="rounded-[2rem] border border-amber-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-amber-700">
            <Star size={18} className="fill-current" />
            <h3 className="text-[10px] font-black uppercase tracking-widest">
              Requester Feedback
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-2xl font-black text-slate-900">
              {Number(data.request.rating.rating ?? 0).toFixed(1)}
            </p>
            <p className="text-sm font-bold text-slate-500">/ 5</p>
          </div>

          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-700">
            {data.request.rating.comment || "No written feedback provided."}
          </p>

          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-slate-400">
            {data.request.rating.requester?.fname || "Requester"} {data.request.rating.requester?.lname || ""} • {formatDateTime(data.request.rating.created_at)}
          </p>
        </section>
      )}

      <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Private Progress Reminders
        </h3>

        <textarea
          value={progressNote}
          onChange={(e) => setProgressNote(e.target.value)}
          placeholder="Add a reminder for yourself. This is not sent to the supervisor."
          className="min-h-[90px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none placeholder:text-slate-500"
        />

        <button
          type="button"
          onClick={() => void saveProgressNote()}
          disabled={busyAction === "progress" || !progressNote.trim()}
          className="mt-3 w-full rounded-xl bg-slate-900 py-4 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
        >
          {busyAction === "progress" ? "Saving..." : "Save Reminder"}
        </button>

        <div className="mt-5 space-y-3">
          {reminders.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              No reminders yet.
            </div>
          ) : (
            reminders.map((note, index) => (
              <div key={note.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Progress #{index + 1}
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {formatDateTime(note.created_at)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">{note.note}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {requestImages.length > 0 && (
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Request Images
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {requestImages.map((image) => (
              <a
                key={image.id}
                href={getImageUrl(image.image_path)}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"
              >
                <Image
                  src={getImageUrl(image.image_path)}
                  alt="Request attachment"
                  width={400}
                  height={240}
                  unoptimized
                  className="h-32 w-full object-cover"
                />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
