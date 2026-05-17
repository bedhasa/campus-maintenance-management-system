import { buildStorageUrl } from "@/lib/runtime-config";

export type InventoryPart = {
  id: number;
  name: string;
  part_code?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  supplier?: string | null;
  quantity_available?: number;
  minimum_stock?: number;
  unit_price?: string | number | null;
  stock_available?: number;
  has_stock?: boolean;
  low_stock?: boolean;
};

export type InventoryPartFormValues = {
  name: string;
  part_code: string;
  unit_price: string;
  quantity_available: string;
  minimum_stock: string;
  image?: File | null;
};

export type InventoryWorkOrder = {
  id: number;
  work_status?: string;
  priority?: string;
  created_at?: string;
  request?: {
    id?: number;
    title?: string;
    status?: string;
    priority?: string;
    created_at?: string;
  } | null;
};

export type InventoryTechnician = {
  id: number;
  fname?: string;
  lname?: string;
  phone?: string | null;
};

export type PartRequestRecord = {
  id: number;
  work_order_id?: number | null;
  technician_id: number;
  part_id: number;
  quantity: number;
  note?: string | null;
  urgency: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected";
  request_date?: string;
  reviewed_by?: number | null;
  technician?: InventoryTechnician | null;
  part?: InventoryPart | null;
  workOrder?: InventoryWorkOrder | null;
  reviewer?: InventoryTechnician | null;
  recorder?: InventoryTechnician | null;
  issue?: {
    id: number;
    quantity_issued: number;
    issue_date?: string;
    issuedBy?: InventoryTechnician | null;
  } | null;
};

export type PartIssueRecord = {
  id: number;
  issue_code?: string | null;
  part_request_id?: number | null;
  work_order_id: number;
  technician_id: number;
  part_id: number;
  part_name_snapshot?: string | null;
  quantity_issued: number;
  unit_cost?: string | number | null;
  total_cost?: string | number | null;
  inventory_officer_name_snapshot?: string | null;
  technician_name_snapshot?: string | null;
  supervisor_name_snapshot?: string | null;
  issue_date?: string;
  technician?: InventoryTechnician | null;
  part?: InventoryPart | null;
  workOrder?: InventoryWorkOrder | null;
  issuedBy?: InventoryTechnician | null;
  supervisor?: InventoryTechnician | null;
  request?: {
    status?: string;
    urgency?: string;
    request_date?: string;
  } | null;
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

export const buildPersonName = (person?: { fname?: string; lname?: string } | null) =>
  [person?.fname, person?.lname].filter(Boolean).join(" ") || "Unknown";

export const urgencyTone = (urgency?: string | null) => {
  switch (urgency) {
    case "high":
      return "bg-rose-50 text-rose-700 border-rose-100";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-100";
    default:
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }
};

export const requestStatusTone = (status?: string | null) => {
  switch (status) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "rejected":
      return "bg-rose-50 text-rose-700 border-rose-100";
    default:
      return "bg-slate-50 text-slate-700 border-slate-100";
  }
};

export const stockTone = (quantity?: number, minimumStock?: number) => {
  if (quantity == null) return "bg-slate-50 text-slate-700 border-slate-100";
  const threshold = Math.max(minimumStock ?? 0, 5);
  if (quantity < threshold) {
    return "bg-rose-50 text-rose-700 border-rose-100";
  }
  return "bg-emerald-50 text-emerald-700 border-emerald-100";
};

export const isLowStock = (quantity?: number, minimumStock?: number) => {
  if (quantity == null) return false;
  const threshold = Math.max(minimumStock ?? 0, 5);
  return quantity < threshold;
};

export const getInventoryImageUrl = (part?: InventoryPart | null) => {
  if (!part) return "";
  if (part.image_url) return part.image_url;
  return buildStorageUrl(part.image_path);
};
