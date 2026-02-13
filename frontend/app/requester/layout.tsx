"use client";

import RoleLayout from "../../components/RoleLayout";

export default function RequesterLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="requester">{children}</RoleLayout>;
}