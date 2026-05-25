"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../App";
import Layout from "./Layout";
import { UserRole } from "../types";
import {
  normalizeUserRole,
  resolveShellRole,
  roleDashboardPath,
} from "../lib/role-routes";

interface RoleLayoutProps {
  role: UserRole;
  children: React.ReactNode;
}

export default function RoleLayout({ role, children }: RoleLayoutProps) {
  const { currentUser, logout } = useApp();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const currentUserRole = normalizeUserRole(currentUser?.role);
  const roleNames = currentUser?.roles ?? [];
  const shellRole = resolveShellRole(currentUserRole, roleNames);
  const hasRoleAccess = Boolean(
    currentUserRole === role || roleNames.includes(role)
  );

  useEffect(() => {
    let isMounted = true;

    const authorize = async () => {
      setIsChecking(true);
      const canAccessRole = Boolean(
        currentUserRole === role || (currentUser?.roles ?? []).includes(role)
      );

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

      if (!canAccessRole) {
        router.replace(roleDashboardPath(currentUserRole));
        if (isMounted) setIsChecking(false);
        return;
      }

      if (isMounted) setIsChecking(false);
    };

    void authorize();

    return () => {
      isMounted = false;
    };
  }, [currentUser, currentUserRole, role, router, logout]);

  if (isChecking || !currentUser || !currentUserRole || !hasRoleAccess || !shellRole) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <Layout user={{ ...currentUser, role: shellRole }} onLogout={handleLogout}>
      {children}
    </Layout>
  );
}
