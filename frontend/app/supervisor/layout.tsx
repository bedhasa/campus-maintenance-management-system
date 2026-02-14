"use client";

import RoleLayout from "../../components/RoleLayout";

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="supervisor">{children}</RoleLayout>;
}

