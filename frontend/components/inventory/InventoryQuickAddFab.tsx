"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardPlus, PackagePlus, Plus, X } from "lucide-react";

export default function InventoryQuickAddFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open ? (
        <>
          <Link
            href="/inventory/list"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-900 shadow-lg"
          >
            <PackagePlus size={16} />
            Spare Part Management
          </Link>
          <Link
            href="/inventory/record-request"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-900 shadow-lg"
          >
            <ClipboardPlus size={16} />
            Record Request
          </Link>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#003366] text-white shadow-2xl transition hover:bg-[#0b4480] active:scale-95"
        aria-label="Quick add"
      >
        {open ? <X size={20} /> : <Plus size={22} />}
      </button>
    </div>
  );
}
