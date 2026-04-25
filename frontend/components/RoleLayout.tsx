"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../App";
import Layout from "./Layout";
import { UserRole } from "../types";
import { normalizeUserRole, roleDashboardPath } from "../lib/role-routes";
import { apiRequest } from "../lib/api";

type UserResponse = {
  user?: {
    active_role?: string | null;
    roles?: Array<{ name?: string }>;
  };
};

interface RoleLayoutProps {
  role: UserRole;
  children: React.ReactNode;
}

export default function RoleLayout({ role, children }: RoleLayoutProps) {
  const { currentUser, logout } = useApp();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const currentUserRole = normalizeUserRole(currentUser?.role);

  useEffect(() => {
    let isMounted = true;

    const authorize = async () => {
      setIsChecking(true);

      if (!currentUser) {
        router.replace("/login");
        if (isMounted) setIsChecking(false);
        return;
      }

      if (!currentUserRole) {
        logout();
        router.replace("/login");
        if (isMounted) setIsChecking(false);
        return;
      }

      if (currentUserRole !== role) {
        router.replace(roleDashboardPath(currentUserRole));
        if (isMounted) setIsChecking(false);
        return;
      }

      try {
        const data = await apiRequest<UserResponse>("/api/user", { method: "GET" }, true);
        const roleName = data.user?.active_role ?? data.user?.roles?.[0]?.name ?? null;
        const normalizedRole = normalizeUserRole(roleName);

        if (!normalizedRole) {
          logout();
          router.replace("/login");
          return;
        }

        if (normalizedRole !== role) {
          router.replace(roleDashboardPath(normalizedRole));
          return;
        }
      } catch {
        logout();
        router.replace("/login");
        return;
      } finally {
        if (isMounted) setIsChecking(false);
      }
    };

    authorize();

    return () => {
      isMounted = false;
    };
  }, [currentUser, currentUserRole, role, router, logout]);

  if (isChecking || !currentUser || !currentUserRole || currentUserRole !== role) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <Layout user={{ ...currentUser, role: currentUserRole }} onLogout={handleLogout}>
      {children}
    </Layout>
  );
}
