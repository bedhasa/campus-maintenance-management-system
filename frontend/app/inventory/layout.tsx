"use client";

import RoleLayout from "../../components/RoleLayout";
import type { ReactNode } from "react";
import InventoryQuickAddFab from "../../components/inventory/InventoryQuickAddFab";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return (
    <RoleLayout role="inventory_officer">
      {children}
      <InventoryQuickAddFab />
    </RoleLayout>
  );
}
