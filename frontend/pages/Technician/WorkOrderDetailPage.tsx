"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  Phone,
  ShieldAlert,
  Star,
  User,
  Wrench,
  X,
} from "lucide-react";
import PageSkeleton from "@/components/PageSkeleton";
import {
  TechnicianRequestSummary,
  TechnicianWorkOrder,
  formatDateTime,
  getPriorityLabel,
  getPriorityTone,
  getStatusLabel,
  getStatusTone,
  getImageUrl,
  getTaskLocation,
} from "./technician-utils";

type SparePartOption = {
  id: number;
  name: string;
  part_code?: string | null;
  quantity_available?: number | null;
  unit_price?: number | string | null;
};

type SelectedSparePart = {
  spare_part_id: string;
  quantity_used: string;
};

type WorkOrderStatusLog = {
  id: number;
  old_status?: string | null;
  new_status: string;
  comment?: string | null;
  created_at?: string;
  changed_by?: { id?: number; fname?: string; lname?: string } | null;
};

type WorkOrderDetail = TechnicianWorkOrder & {
  request?: (TechnicianRequestSummary & {
    requester?: { fname?: string; lname?: string; phone?: string | null } | null;
    images?: Array<{ id: number; image_path: string }>;
    messages?: Array<{
      id: number;
      message: string;
      created_at: string;
      sender?: { fname?: string; lname?: string } | null;
    }>;
    rating?: {
      rating?: number;
      comment?: string | null;
      created_at?: string;
      requester?: { fname?: string; lname?: string } | null;
    } | null;
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
  status_logs?: WorkOrderStatusLog[];
};

type Props = {
  id: string;
};

type ToastState = {
  type: "error" | "success";
  message: string;
} | null;

type BusyAction = "start" | "decline" | "pause" | "progress" | "delay" | "complete" | null;

const defaultSparePartRow = (): SelectedSparePart => ({
  spare_part_id: "",
  quantity_used: "1",
});

export default function WorkOrderDetailPage({ id }: Props) {
  const [data, setData] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  const [progressNote, setProgressNote] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [pauseReason, setPauseReason] = useState("");
  const [whatFixed, setWhatFixed] = useState("");
  const [problemFound, setProblemFound] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [spareParts, setSpareParts] = useState<SparePartOption[]>([]);
  const [selectedSpareParts, setSelectedSpareParts] = useState<SelectedSparePart[]>([
    defaultSparePartRow(),
  ]);

  const statusLabel = useMemo(() => {
    if (!data?.work_status || data.work_status === "assigned") return "Pending";
    return getStatusLabel(data.work_status);
  }, [data?.work_status]);

  const statusTone = useMemo(() => {
    return getStatusTone(data?.work_status);
  }, [data?.work_status]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const applyWorkOrder = useCallback((detail: WorkOrderDetail) => {
    setData((prev) => ({
      ...(prev ?? detail),
      ...detail,
      request: detail.request ?? prev?.request ?? null,
      spare_parts: detail.spare_parts ?? prev?.spare_parts,
      status_logs: detail.status_logs ?? prev?.status_logs,
    }));

    if (detail.delay_reason !== undefined) setDelayReason(detail.delay_reason ?? "");
    if (detail.completion_note !== undefined) setWhatFixed(detail.completion_note ?? "");
    if (detail.problem_found !== undefined) setProblemFound(detail.problem_found ?? "");
    if (detail.action_taken !== undefined) setActionTaken(detail.action_taken ?? "");
  }, []);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/technician/work-orders/${id}`,
        { method: "GET" },
        true,
      );

      applyWorkOrder(response.work_order);

      const parts = await apiRequest<{ success: boolean; spare_parts: SparePartOption[] }>(
        "/api/technician/spare-parts",
        { method: "GET" },
        true,
      );
      setSpareParts(parts.spare_parts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load work order.");
    } finally {
      setLoading(false);
    }
  }, [applyWorkOrder, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    const wasPaused = data?.work_status === "paused";
    const nextStatus = "in_progress";
    optimisticStatusUpdate(nextStatus);
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
        message: wasPaused ? "Job resumed." : "Job started.",
      });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to update status." });
      void load();
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
      void load();
    } finally {
      setBusyAction(null);
    }
  };

  const decline = async () => {
    const reason = window.prompt("Why are you declining this assignment?");
    if (!reason || !reason.trim()) {
      setToast({ type: "error", message: "Decline reason is required." });
      return;
    }

    try {
      setBusyAction("decline");
      const response = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/technician/work-orders/${id}/decline`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
        true,
      );
      applyWorkOrder(response.work_order);
      setToast({ type: "success", message: "Assignment declined. Supervisor notified." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to decline assignment." });
      void load();
    } finally {
      setBusyAction(null);
    }
  };

  const saveProgressNote = async () => {
    const note = progressNote.trim();
    if (!note) {
      setToast({ type: "error", message: "Please add a progress note first." });
      return;
    }

    try {
      setBusyAction("progress");
      const response = await apiRequest<{
        success: boolean;
        data: {
          id: number;
          message: string;
          created_at: string;
          sender?: { id?: number; fname?: string; lname?: string } | null;
        };
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
              request: prev.request
                ? {
                    ...prev.request,
                    messages: [
                      ...(prev.request.messages ?? []),
                      {
                        id: response.data.id,
                        message: response.data.message,
                        created_at: response.data.created_at,
                        sender: response.data.sender ?? null,
                      },
                    ],
                  }
                : prev.request,
            }
          : prev,
      );
      setToast({ type: "success", message: "Progress note saved." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to save note." });
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
      setToast({ type: "success", message: "Delay reported to supervisor." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to report delay." });
    } finally {
      setBusyAction(null);
    }
  };

  const updateSparePartRow = (index: number, field: keyof SelectedSparePart, value: string) => {
    setSelectedSpareParts((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
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
    try {
      setBusyAction("complete");

      const validSpareParts = selectedSpareParts
        .filter((row) => row.spare_part_id && Number(row.quantity_used) > 0)
        .map((row) => ({
          spare_part_id: Number(row.spare_part_id),
          quantity_used: Number(row.quantity_used),
        }));

      const formData = new FormData();
      formData.append("completion_note", whatFixed.trim());
      if (problemFound.trim()) formData.append("problem_found", problemFound.trim());
      if (actionTaken.trim()) formData.append("action_taken", actionTaken.trim());
      if (delayReason.trim()) formData.append("delay_reason", delayReason.trim());
      if (imageFile) formData.append("image", imageFile);

      validSpareParts.forEach((part, index) => {
        formData.append(`spare_parts[${index}][spare_part_id]`, String(part.spare_part_id));
        formData.append(`spare_parts[${index}][quantity_used]`, String(part.quantity_used));
      });

      optimisticStatusUpdate("completed");
      const response = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
        `/api/technician/work-orders/${id}/complete`,
        {
          method: "PATCH",
          body: formData,
        },
        true,
      );

      applyWorkOrder(response.work_order);
      setToast({ type: "success", message: "Work order completed and sent for approval." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to complete work order." });
      void load();
    } finally {
      setBusyAction(null);
    }
  };

  const requestImages = data?.request?.images ?? [];
  const statusLogs = data?.status_logs ?? [];
  const requesterRating = data?.request?.rating;

  if (loading) return <PageSkeleton cards={2} rows={4} />;

  if (!data) {
    return (
      <div className="p-10 text-center font-bold text-rose-500">
        {error || "Work order not found."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-28 pt-4">
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

      <div className="space-y-3">
        <h1 className="text-2xl font-black leading-tight text-slate-900">
          {data?.request?.title || `Work Order #${data.id}`}
        </h1>
        <div className="flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-slate-600">
          <MapPin size={16} className="text-blue-600" />
          <span className="text-xs font-bold uppercase tracking-tight">
            {getTaskLocation(data)}
          </span>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[2rem] bg-[#003366] p-6 text-white shadow-xl">
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Requester</p>
            <h2 className="text-xl font-black tracking-tight">
              {data?.request?.requester?.fname || "Unknown"} {data?.request?.requester?.lname || "Requester"}
            </h2>
            <p className="font-mono text-sm text-blue-200">
              {data?.request?.requester?.phone || "Phone hidden"}
            </p>
          </div>
          {data?.request?.requester?.phone ? (
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

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Problem Description
        </h3>
        <p className="text-sm font-medium leading-relaxed text-slate-700 italic">
          {data?.request?.description || "No description provided."}
        </p>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${getPriorityTone(data.request?.priority)}`}>
            {getPriorityLabel(data.request?.priority)}
          </span>
          <span className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusTone}`}>
            {getStatusLabel(data.work_status)}
          </span>
        </div>
        <div className="grid gap-3">
          {(data.work_status === "assigned" || data.work_status === "paused") && (
            <button
              type="button"
              onClick={() => void start()}
              disabled={busyAction === "start"}
              className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-[#003366] py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <PlayCircle size={20} />
              {busyAction === "start"
                ? "Updating Status..."
                : data.work_status === "paused"
                  ? "Resume Job Now"
                  : "Start This Job"}
            </button>
          )}

          {data.work_status === "assigned" && (
            <button
              type="button"
              onClick={() => void decline()}
              disabled={busyAction === "decline" || busyAction === "start"}
              className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] border border-rose-200 bg-rose-50 py-4 text-sm font-black uppercase tracking-widest text-rose-700 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <X size={18} />
              {busyAction === "decline" ? "Submitting..." : "Decline Assignment"}
            </button>
          )}

          {data.work_status === "in_progress" && (
            <button
              type="button"
              onClick={() => void pause()}
              disabled={busyAction === "pause"}
              className="flex w-full items-center justify-center gap-3 rounded-[1.5rem] bg-amber-500 py-5 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <PauseCircle size={20} />
              {busyAction === "pause" ? "Pausing..." : "Pause Work Order"}
            </button>
          )}
        </div>
      </section>

      {(data.work_status === "in_progress" || data.work_status === "paused") && (
        <div className="space-y-6">
          <section className="rounded-[2.5rem] border-2 border-emerald-500/10 bg-white p-6 shadow-2xl shadow-emerald-900/5">
            <h3 className="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-slate-900">
              <CheckCircle2 size={18} className="text-emerald-500" />
              Completion Report
            </h3>

            <div className="space-y-5">
              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                  What You Fixed
                  <span className="ml-1 text-slate-300">(Optional)</span>
                </label>
                <textarea
                  value={whatFixed}
                  onChange={(e) => setWhatFixed(e.target.value)}
                  className="min-h-[100px] w-full rounded-2xl border-2 border-slate-50 bg-slate-50 p-4 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-500 placeholder:opacity-100 focus:border-emerald-200 focus:bg-white"
                  placeholder="Describe the final fix or what was completed."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                    Problem Found
                    <span className="ml-1 text-slate-300">(Optional)</span>
                  </label>
                  <textarea
                    value={problemFound}
                    onChange={(e) => setProblemFound(e.target.value)}
                    className="min-h-[90px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none placeholder:text-slate-500 placeholder:opacity-100"
                    placeholder="What issue did you find?"
                  />
                </div>

                <div className="space-y-1">
                  <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                    Action Taken
                    <span className="ml-1 text-slate-300">(Optional)</span>
                  </label>
                  <textarea
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    className="min-h-[90px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none placeholder:text-slate-500 placeholder:opacity-100"
                    placeholder="Any optional action taken?"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                  Spare Parts Used
                  <span className="ml-1 text-slate-300">(Optional)</span>
                </label>
                <div className="space-y-3">
                  {selectedSpareParts.map((item, index) => (
                    <div key={`${index}-${item.spare_part_id}`} className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2">
                      <select
                        value={item.spare_part_id}
                        onChange={(e) => updateSparePartRow(index, "spare_part_id", e.target.value)}
                        className="flex-1 rounded-xl border-none bg-white px-4 py-3 text-xs font-bold text-slate-900"
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
                        className="w-20 rounded-xl border-none bg-white px-2 py-3 text-center text-xs font-black text-slate-900"
                      />
                      <button type="button" onClick={() => removeSparePartRow(index)} className="p-2 text-rose-500">
                        <X size={18} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addSparePartRow}
                    className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:bg-slate-50"
                  >
                    + Add Spare Part
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="ml-1 text-[10px] font-black uppercase text-slate-400">
                  Image Upload
                  <span className="ml-1 text-slate-300">(Optional)</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600">
                  <Camera size={18} className="shrink-0 text-slate-400" />
                  <span className="flex-1">
                    {imageFile ? imageFile.name : "Attach a photo if it helps document the completion"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => void complete()}
                disabled={busyAction === "complete"}
                className="w-full rounded-2xl bg-emerald-600 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {busyAction === "complete" ? "Submitting..." : "Submit Completion"}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200/60 bg-slate-50 p-6">
            <h4 className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <MessageSquare size={16} />
              Progress Notes
            </h4>
            <textarea
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="Add a quick update for the requester or supervisor..."
              className="mb-3 min-h-[90px] w-full rounded-2xl border border-slate-200 p-4 text-sm text-slate-900 outline-none placeholder:text-slate-500 placeholder:opacity-100"
            />
            <button
              type="button"
              onClick={() => void saveProgressNote()}
              disabled={busyAction === "progress" || !progressNote.trim()}
              className="w-full rounded-xl bg-slate-900 py-4 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
            >
              {busyAction === "progress" ? "Posting..." : "Post Update"}
            </button>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <h4 className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-700">
              <ShieldAlert size={16} />
              Delay Report
            </h4>
            <textarea
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              placeholder="Explain why the job is delayed or paused."
              className="mb-3 min-h-[90px] w-full rounded-2xl border border-amber-200 bg-white p-4 text-sm text-slate-900 outline-none placeholder:text-slate-500 placeholder:opacity-100"
            />
            <button
              type="button"
              onClick={() => void reportDelay()}
              disabled={busyAction === "delay" || !delayReason.trim()}
              className="w-full rounded-xl bg-amber-600 py-4 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
            >
              {busyAction === "delay" ? "Reporting..." : "Report Delay"}
            </button>
          </section>
        </div>
      )}

      {data.work_status === "completed" && (
        <section className="space-y-4 rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
            <CheckCircle2 size={28} className="text-white" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-emerald-900">
            Work Completed
          </h2>
          <p className="px-4 text-sm font-medium leading-relaxed text-emerald-700">
            This job has been submitted and is waiting for supervisor approval.
          </p>

          {(data.completion_note || data.problem_found || data.action_taken || data.completed_at) && (
            <div className="space-y-3 rounded-2xl bg-white p-4 text-left">
              {data.completion_note && (
                <p className="text-sm text-slate-700">
                  <span className="font-black text-slate-900">What fixed:</span> {data.completion_note}
                </p>
              )}
              {data.problem_found && (
                <p className="text-sm text-slate-700">
                  <span className="font-black text-slate-900">Problem found:</span> {data.problem_found}
                </p>
              )}
              {data.action_taken && (
                <p className="text-sm text-slate-700">
                  <span className="font-black text-slate-900">Action taken:</span> {data.action_taken}
                </p>
              )}
              {data.completed_at && (
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <Clock3 size={14} />
                  Completed at {formatDateTime(data.completed_at)}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {requesterRating && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Star size={18} className="text-amber-500" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Requester Feedback
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                size={16}
                className={index < Math.round(requesterRating.rating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}
              />
            ))}
          </div>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-700">
            {requesterRating.comment || "No written feedback provided."}
          </p>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            {formatDateTime(requesterRating.created_at)}
          </p>
        </section>
      )}

      {statusLogs.length > 0 && (
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Wrench size={16} />
            Status History
          </h3>
          <div className="space-y-3">
            {statusLogs.map((log) => (
              <div key={log.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900">
                    {getStatusLabel(log.new_status)}
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
                {log.comment && (
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                    {log.comment}
                  </p>
                )}
                {log.changed_by && (
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                    By {log.changed_by.fname || ""} {log.changed_by.lname || ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {requestImages.length > 0 && (
        <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Camera size={16} />
            Images
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
