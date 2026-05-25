"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, clearAuth } from "@/lib/api";
import { normalizeUserRole, roleDashboardPath } from "@/lib/role-routes";

export default function Dashboard() {
  const router = useRouter();
  const hasResolvedRef = useRef(false);

  useEffect(() => {
    if (hasResolvedRef.current) {
      return;
    }
    hasResolvedRef.current = true;

    let isActive = true;

    const redirectToRoleDashboard = async () => {
      try {
        const data = await apiRequest<{ user?: { active_role?: string | null; roles?: Array<{ name?: string }> } }>(
          "/api/user",
          { method: "GET" },
          true
        );
        const roleName = data.user?.active_role ?? data.user?.roles?.[0]?.name ?? null;
        const normalizedRole = normalizeUserRole(roleName);
        const destination = normalizedRole ? roleDashboardPath(normalizedRole) : "/login";
        if (isActive) {
          router.replace(destination);
        }
      } catch {
        clearAuth();
        if (isActive) {
          router.replace("/login");
        }
      }
    };

    void redirectToRoleDashboard();

    return () => {
      isActive = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-10 rounded-2xl shadow-lg text-center">
        <h1 className="text-3xl font-bold text-slate-900">Redirecting...</h1>
        <p className="mt-4 text-slate-600">
          Taking you to your role dashboard.
        </p>
      </div>
    </div>
  );
}
