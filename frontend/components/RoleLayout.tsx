"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../App";
import Layout from "./Layout";
import { UserRole } from "../types";
import { normalizeUserRole, roleDashboardPath } from "../lib/role-routes";

interface RoleLayoutProps {
  role: UserRole;
  children: React.ReactNode;
}

export default function RoleLayout({ role, children }: RoleLayoutProps) {
  const { currentUser, logout } = useApp();
  const router = useRouter();
  const currentUserRole = normalizeUserRole(currentUser?.role);

  useEffect(() => {
    if (!currentUser) {
      router.replace("/login");
      return;
    }

    if (!currentUserRole) {
      router.replace("/login");
      return;
    }

    if (currentUserRole !== role) {
      router.replace(roleDashboardPath(currentUserRole));
    }
  }, [currentUser, currentUserRole, role, router]);

  if (!currentUser || !currentUserRole || currentUserRole !== role) {
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
