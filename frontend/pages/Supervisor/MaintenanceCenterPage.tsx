"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarClock,
  ClipboardPlus,
  MoveRight,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import ManualWorkOrderPage from "./ManualWorkOrderPage";
import PreventiveMaintenancePage from "./PreventiveMaintenancePage";

type HubTab = "manual" | "pm";

const tabs = [
  {
    id: "manual",
    label: "Manual WO",
    description: "Create and assign corrective work.",
    icon: ClipboardPlus,
  },
  {
    id: "pm",
    label: "Preventive Maintenance",
    description: "Manage recurring schedules.",
    icon: CalendarClock,
  },
] as const;

export default function MaintenanceCenterPage() {
  const searchParams = useSearchParams();
  const activeTab: HubTab = (searchParams?.get("tab") as HubTab) || "manual";

  return (
    <div className="space-y-6 pb-10 max-w-[1600px] mx-auto">
      {/* Header & Navigation Section */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[1fr_350px]">
          
          {/* Left Side: Title & Tabs */}
          <div className="p-6 md:p-8 border-b xl:border-b-0 xl:border-r bg-slate-50/30">
            <div className="flex flex-col gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700">
                  <Sparkles size={12} />
                  Maintenance Hub
                </div>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">
                  Manage Operations
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Manual work orders and preventive maintenance live here. Asset registration stays in Facility Management.
                </p>
              </div>

              {/* Navigation Tabs (Primary Nav) */}
              <div className="grid gap-3 md:grid-cols-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <Link
                      key={tab.id}
                      href={`?tab=${tab.id}`}
                      className={`group flex items-center gap-4 rounded-2xl border p-4 transition-all ${
                        isActive
                          ? "border-sky-500 bg-white shadow-md ring-1 ring-sky-500/10"
                          : "border-slate-200 bg-white/50 hover:bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className={`rounded-xl p-2.5 ${isActive ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <h2 className={`text-sm font-bold ${isActive ? "text-slate-900" : "text-slate-600"}`}>{tab.label}</h2>
                        <p className="text-xs text-slate-400 line-clamp-1">{tab.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: Secondary Actions */}
          <div className="bg-slate-50 p-6 md:p-8 flex flex-col justify-center">
             <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Quick Shortcuts</p>
             <div className="space-y-2">
                {[
                    { label: "Active Orders", href: "/supervisor/work-orders", icon: MoveRight },
                    { label: "Review Requests", href: "/supervisor/requests", icon: MoveRight },
                ].map((link) => (
                    <Link key={link.label} href={link.href} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 transition-colors">
                        {link.label}
                        <link.icon size={14} />
                    </Link>
                ))}
             </div>
          </div>
        </div>
      </section>

      {/* Dynamic Content Area */}
      <main className="rounded-3xl border border-slate-200 bg-white shadow-sm min-h-[500px]">
        {/* Sub-header for the tool */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <h2 className="text-lg font-black text-slate-900 capitalize">
                {activeTab === 'pm' ? 'Preventive Schedules' : 'Manual Work Orders'}
            </h2>
            <div className="flex gap-2">
                {activeTab === 'pm' && (
                    <button onClick={() => window.dispatchEvent(new Event("pm-trigger-due-requested"))} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">
                        <Play size={12} fill="currentColor" /> Run Check
                    </button>
                )}
                <button className="p-2 text-slate-400 hover:text-slate-600"><RefreshCw size={18}/></button>
            </div>
        </div>

        <div className="p-6">
            {activeTab === "pm" && <PreventiveMaintenancePage embedded />}
            {activeTab === "manual" && <ManualWorkOrderPage embedded />}
        </div>
      </main>
    </div>
  );
}
