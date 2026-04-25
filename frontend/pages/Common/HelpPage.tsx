"use client";

import type { ReactNode } from "react";

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Help & Support</p>
        <h1 className="text-2xl font-black text-slate-900">Inventory Officer Guide</h1>
        <p className="text-sm font-medium text-slate-500">
          Quick answers for using the inventory dashboard, catalog, request recording, and issue history.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 text-sm text-slate-700 shadow-sm">
        <p className="font-bold text-slate-900">Common Tasks</p>
        <HelpItem title="Dashboard">Check low stock, pending requests, and recent activity.</HelpItem>
        <HelpItem title="Spare Parts Management">Add or edit spare parts and keep stock records up to date.</HelpItem>
        <HelpItem title="Record Requests">Capture the technician request details and save them into the workflow.</HelpItem>
        <HelpItem title="Request Queue">Approve, reject, and issue parts from the request queue.</HelpItem>
        <HelpItem title="Issue History">Review all issued parts for audit and reporting.</HelpItem>
        <HelpItem title="Notifications">See alerts for new requests, approvals, and issues.</HelpItem>
      </section>

      <form className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 shadow-sm">
        <p className="font-bold text-slate-900">Report System Issue</p>
        <input className="w-full rounded-lg border p-2 text-sm" placeholder="Issue title" />
        <textarea className="min-h-28 w-full rounded-lg border p-2 text-sm" placeholder="Describe the issue" />
        <button type="button" className="rounded-xl bg-[#003366] px-4 py-2 text-sm font-bold text-white">
          Submit
        </button>
      </form>
    </div>
  );
}

function HelpItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}
