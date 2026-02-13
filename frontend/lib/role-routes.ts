import { UserRole } from "../types";

const ROLE_ALIASES: Record<string, UserRole> = {
  requester: "requester",
  supervisor: "supervisor",
  technician: "technician",
  inventory: "inventory_officer",
  inventory_officer: "inventory_officer",
  admin: "admin",
};

export const normalizeUserRole = (role: string | null | undefined): UserRole | null => {
  if (!role) return null;
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ROLE_ALIASES[normalized] ?? null;
};

export const roleToBasePath = (role: UserRole | null | undefined): string => {
  if (role === "inventory_officer") return "/inventory";
  if (!role) return "/requester";
  return `/${role}`;
};

export const roleDashboardPath = (role: UserRole | null | undefined): string => {
  return `${roleToBasePath(role)}/dashboard`;
};
