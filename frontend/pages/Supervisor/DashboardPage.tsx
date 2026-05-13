"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  MapPinned,
  PlusCircle,
  Wrench,
} from "lucide-react";

type DashboardPayload = {
  success: boolean;
  summary: {
    new_requests: number;
    approved_pending_assignment: number;
    in_progress: number;
    completed_waiting_closure: number;
    overdue: number;
  };
  pm_overview: {
    upcoming_this_week: number;
    overdue_preventive: number;
  };
};

type RequestsPayload = {
  success: boolean;
  requests: {
    data: Array<{
      id: number;
      title: string;
      status: string;
      created_at: string;
      updated_at?: string;
      department?: { name?: string };
    }>;
  };
};

type AnalyticsLitePayload = {
  success: boolean;
  by_category: Array<{ name: string; total: number; percentage: number }>;
  trend: Array<{ date: string; total: number }>;
  by_department: Array<{ name: string; total: number }>;
  by_building: Array<{ name: string; total: number }>;
};

type RecentActivity = {
  key: string;
  id: number;
  action: "APPROVED" | "ASSIGNED" | "REJECTED";
  title: string;
  description: string;
  at: string;
};

const DonutChart = dynamic(() => import("@/components/supervisor/analytics/DonutChart"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />,
});

const TrendLineChart = dynamic(() => import("@/components/supervisor/analytics/TrendLineChart"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />,
});

export default function SupervisorDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsLitePayload | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    const run = async () => {
      const [dashboard, analyticsData, approved, assigned, rejected] = await Promise.all([
        apiRequest<DashboardPayload>("/api/supervisor/dashboard", { method: "GET" }, true),
        apiRequest<AnalyticsLitePayload>("/api/supervisor/analytics?period=yearly", { method: "GET" }, true),
        apiRequest<RequestsPayload>("/api/supervisor/requests?status=approved", { method: "GET" }, true),
        apiRequest<RequestsPayload>("/api/supervisor/requests?status=assigned", { method: "GET" }, true),
        apiRequest<RequestsPayload>("/api/supervisor/requests?status=rejected", { method: "GET" }, true),
      ]);

      const toActivity = (
        rows: RequestsPayload["requests"]["data"],
        action: RecentActivity["action"]
      ): RecentActivity[] =>
        rows.map((item) => ({
          key: `${action}-${item.id}`,
          id: item.id,
          action,
          title: item.title,
          description:
            action === "APPROVED"
              ? `Status set to APPROVED. Department: ${item.department?.name ?? "General"}. Next step: assign technician.`
              : action === "ASSIGNED"
              ? `Status set to ASSIGNED. Department: ${item.department?.name ?? "General"}. Next step: technician starts work.`
              : `Status set to REJECTED. Department: ${item.department?.name ?? "General"}. Next step: requester updates and resubmits.`,
          at: item.updated_at ?? item.created_at,
        }));

      const merged = [
        ...toActivity(approved.requests?.data ?? [], "APPROVED"),
        ...toActivity(assigned.requests?.data ?? [], "ASSIGNED"),
        ...toActivity(rejected.requests?.data ?? [], "REJECTED"),
      ]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 10);

      setRecentActivity(merged);
      setData(dashboard);
      setAnalytics(analyticsData);
    };

    void run();
  }, []);

  if (!data) return <PageSkeleton cards={5} rows={6} />;

  const primaryCards = [
    {
      label: "Pending Requests",
      value: data.summary.new_requests,
      href: "/supervisor/requests?status=submitted",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      icon: <Clock3 size={18} className="text-amber-600" />,
    },
    {
      label: "Approved",
      value: data.summary.approved_pending_assignment,
      href: "/supervisor/requests?status=approved",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      icon: <CheckCircle2 size={18} className="text-emerald-600" />,
    },
    {
      label: "In Progress",
      value: data.summary.in_progress,
      href: "/supervisor/work-orders?status=in_progress",
      tone: "border-blue-200 bg-blue-50 text-blue-900",
      icon: <Wrench size={18} className="text-blue-600" />,
    },
    {
      label: "Pending Closure",
      value: data.summary.completed_waiting_closure,
      href: "/supervisor/work-orders?status=completed",
      tone: "border-violet-200 bg-violet-50 text-violet-900",
      icon: <ClipboardCheck size={18} className="text-violet-600" />,
    },
  ];

  const donutSlices =
    analytics?.by_category?.slice(0, 6).map((row) => ({
      name: row.name,
      total: row.total,
      percentage: row.percentage,
    })) ?? [];

  const trendPoints =
    analytics?.trend?.reduce((acc, row) => {
      const label = new Date(row.date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const last = acc[acc.length - 1];
      if (last && last.label === label) {
        last.value += row.total;
      } else {
        acc.push({ label, value: row.total });
      }
      return acc;
    }, [] as Array<{ label: string; value: number }>) ?? [];

  const topDepartments = analytics?.by_department?.slice(0, 5) ?? [];
  const topBuildings = analytics?.by_building?.slice(0, 5) ?? [];

  const actionBadge = (action: RecentActivity["action"]) => {
    if (action === "APPROVED") return "bg-emerald-100 text-emerald-700";
    if (action === "ASSIGNED") return "bg-blue-100 text-blue-700";
    return "bg-rose-100 text-rose-700";
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Supervisor Dashboard</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Maintenance Analytics Overview</h1>
        </div>
        <Link
          href="/supervisor/maintenance-center"
          className="inline-flex items-center gap-2 rounded-xl bg-[#003366] px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#0b4480]"
        >
          <PlusCircle size={16} />
          New Work Order
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-8">
          {primaryCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.15em]">{card.label}</p>
                {card.icon}
              </div>
              <p className="mt-3 text-3xl font-black">{card.value}</p>
            </Link>
          ))}
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Link
            href="/supervisor/work-orders?filter=overdue"
            className="block rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-rose-700">Overdue</p>
              <AlertTriangle size={18} className="text-rose-600" />
            </div>
            <p className="mt-2 text-3xl font-black text-rose-900">{data.summary.overdue}</p>
            <p className="text-xs font-semibold text-rose-700">Work orders past due date</p>
          </Link>

          <Link
            href="/supervisor/maintenance-center?tab=pm"
            className="block rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-sky-700">PM</p>
              <Activity size={18} className="text-sky-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-sky-900">
              {data.pm_overview.upcoming_this_week} / {data.pm_overview.overdue_preventive}
            </p>
            <p className="text-xs font-semibold text-sky-700">Upcoming vs overdue preventive tasks</p>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <DonutChart title="Issue Categories (Pie)" slices={donutSlices} mode="number" />
        </div>
        <div className="xl:col-span-7">
          <TrendLineChart title="Request Trend (Line)" points={trendPoints} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-800">
          Top 5 Departments & Buildings
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Departments</p>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topDepartments.map((row) => (
                    <tr key={`dep-${row.name}`} className="text-sm">
                      <td className="px-3 py-2 font-semibold text-slate-700">{row.name}</td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">{row.total}</td>
                    </tr>
                  ))}
                  {topDepartments.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-slate-400">
                        No department data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Buildings</p>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Building</th>
                    <th className="px-3 py-2 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topBuildings.map((row) => (
                    <tr key={`building-${row.name}`} className="text-sm">
                      <td className="px-3 py-2 font-semibold text-slate-700">{row.name}</td>
                      <td className="px-3 py-2 text-right font-black text-slate-900">{row.total}</td>
                    </tr>
                  ))}
                  {topBuildings.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-slate-400">
                        No building data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-800">Recent Activity (Top 10)</h3>
          <Link
            href="/supervisor/requests"
            className="text-xs font-black uppercase tracking-wider text-[#003366] hover:text-[#0b4480]"
          >
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                <th className="pb-3">Action</th>
                <th className="pb-3">Request</th>
                <th className="pb-3">Description</th>
                <th className="pb-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivity.map((activity) => (
                <tr key={activity.key} className="text-sm transition hover:bg-slate-50/70">
                  <td className="py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${actionBadge(activity.action)}`}>
                      {activity.action}
                    </span>
                  </td>
                  <td className="py-3">
                    <Link href={`/supervisor/requests/${activity.id}`} className="group inline-flex items-center gap-2 font-black text-slate-900 hover:text-[#003366]">
                      {activity.title}
                      <ArrowUpRight size={14} className="text-slate-400 transition group-hover:text-[#003366]" />
                    </Link>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">Request ID #{activity.id}</p>
                  </td>
                  <td className="py-3 text-slate-600">
                    <p className="max-w-[420px] text-sm leading-relaxed">{activity.description}</p>
                  </td>
                  <td className="py-3 text-right">
                    <p className="text-xs font-black text-slate-700">{new Date(activity.at).toLocaleDateString()}</p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {new Date(activity.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recentActivity.length === 0 && (
          <p className="py-6 text-center text-sm font-semibold text-slate-500">No approved, assigned, or rejected activity found.</p>
        )}
      </div>

      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8">
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-slate-500">
          <MapPinned size={34} />
          <p className="text-sm font-black uppercase tracking-[0.15em]">Map Placeholder</p>
          <p className="text-xs font-semibold">Location heat-map area for requests and work orders</p>
        </div>
      </div>
    </div>
  );
}
