export type TechnicianRequestSummary = {
  id: number;
  title?: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  status?: string;
  due_date?: string | null;
  created_at?: string;
  category?: { id?: number; name?: string } | null;
  building?: { id?: number; name?: string } | null;
  room?: { id?: number; name?: string } | null;
  images?: Array<{ id: number; image_path: string }>;
  rating?: {
    rating?: number;
    comment?: string | null;
    created_at?: string;
    requester?: { fname?: string; lname?: string } | null;
  } | null;
  messages?: Array<{
    id: number;
    message: string;
    created_at: string;
    sender?: { id?: number; fname?: string; lname?: string } | null;
  }>;
};

export type TechnicianWorkOrder = {
  id: number;
  work_status: "assigned" | "in_progress" | "paused" | "completed" | string;
  delay_reason?: string | null;
  completion_note?: string | null;
  problem_found?: string | null;
  action_taken?: string | null;
  created_at?: string;
  updated_at?: string;
  started_at?: string | null;
  paused_at?: string | null;
  resumed_at?: string | null;
  status_updated_at?: string | null;
  completed_by_technician_at?: string | null;
  completed_at?: string | null;
  request?: TechnicianRequestSummary | null;
};

export type TechnicianDashboardResponse = {
  success: boolean;
  summary: {
    assigned: number;
    in_progress: number;
    completed: number;
    overdue: number;
  };
  assigned_jobs: {
    data: TechnicianWorkOrder[];
  };
};

export const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
};

export const formatDateTime = (value?: string | null) => {
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

export const getTaskTitle = (task: TechnicianWorkOrder) =>
  task.request?.title?.trim() || `Work Order #${task.id}`;

export const getTaskLocation = (task: TechnicianWorkOrder) => {
  const building = task.request?.building?.name;
  const room = task.request?.room?.name;
  if (building || room) {
    return `Building: ${building || "-"} | Room: ${room || "-"}`;
  }
  return "Location not specified";
};

export const getPriorityTone = (priority?: string | null) => {
  switch (priority) {
    case "urgent":
      return "bg-rose-50 text-rose-700 border-rose-100";
    case "high":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "medium":
      return "bg-blue-50 text-blue-700 border-blue-100";
    default:
      return "bg-slate-50 text-slate-700 border-slate-100";
  }
};

export const getStatusTone = (status?: string | null) => {
  switch (status) {
    case "assigned":
      return "bg-indigo-50 text-indigo-700 border-indigo-100";
    case "in_progress":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "paused":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    default:
      return "bg-slate-50 text-slate-700 border-slate-100";
  }
};

export const getPriorityLabel = (priority?: string | null) => {
  if (!priority) return "Normal";
  return priority.replace("_", " ").toUpperCase();
};

export const getStatusLabel = (status?: string | null) => {
  if (!status || status === "assigned") return "Pending";
  if (status === "paused") return "Paused";
  return status.replace("_", " ");
};

export const isDelayedTask = (task: TechnicianWorkOrder, nowMs?: number | null) => {
  if (task.delay_reason) return true;
  if (nowMs == null) return false;
  const dueDate = task.request?.due_date;
  if (!dueDate) return false;
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < nowMs && task.work_status !== "completed";
};

export const getImageUrl = (path?: string | null) => {
  if (!path) return "";
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return path.startsWith("http") ? path : `${baseUrl}/storage/${path.replace(/^\/+/, "")}`;
};
