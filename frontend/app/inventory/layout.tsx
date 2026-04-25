"use client";

import RoleLayout from "../../components/RoleLayout";
import type { ReactNode } from "react";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return <RoleLayout role="inventory_officer">{children}</RoleLayout>;
}
