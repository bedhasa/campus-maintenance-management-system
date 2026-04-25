"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { ChevronDown, ChevronUp, History, Hash, User, Calendar, Package } from "lucide-react";
import { PartIssueRecord, buildPersonName, formatDateTime } from "./inventory-utils";

type IssuesResponse = {
  success: boolean;
  part_issues: { data: PartIssueRecord[] };
};

export default function IssueHistoryPage() {
  const [items, setItems] = useState<PartIssueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<IssuesResponse>("/api/inventory/part-issues", { method: "GET" }, true);
      setItems(response.part_issues?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleRow = (id: number) => setExpandedId(expandedId === id ? null : id);

  if (loading) return <PageSkeleton cards={1} rows={8} />;

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 pb-12 pt-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-amber-600">
          <History size={14} />
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Inventory Audit</p>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Issue History</h1>
      </header>

      <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 bg-slate-50/50 px-6 py-4 border-b border-slate-100">
          <div className="col-span-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Spare Part</div>
          <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Work Order</div>
          <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Qty</div>
          <div className="col-span-2"></div>
        </div>

        <div className="divide-y divide-slate-50">
          {items.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
              No transaction history available
            </div>
          ) : (
            items.map((issue) => {
              const isExpanded = expandedId === issue.id;
              return (
                <div key={issue.id} className={`transition-colors ${isExpanded ? 'bg-slate-50/30' : 'hover:bg-slate-50/20'}`}>
                  {/* Table Row */}
                  <div 
                    onClick={() => toggleRow(issue.id)}
                    className="grid grid-cols-12 gap-4 px-6 py-5 items-center cursor-pointer select-none"
                  >
                    <div className="col-span-5">
                      <p className="font-black text-slate-900 truncate">{issue.part?.name || "Unknown Part"}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{issue.part?.part_code || "N/A"}</p>
                    </div>
                    <div className="col-span-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black">
                        {toWorkOrderCode(issue.work_order_id, issue.workOrder?.created_at)}
                      </span>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="text-sm font-black text-emerald-600">x{issue.quantity_issued}</span>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {isExpanded ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
                    </div>
                  </div>

                  {/* Expanded Info Area */}
                  {isExpanded && (
                    <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <DetailCard 
                          icon={<User size={14}/>} 
                          label="Recipient Technician" 
                          value={buildPersonName(issue.technician)} 
                        />
                        <DetailCard 
                          icon={<Hash size={14}/>} 
                          label="Issued By (Admin)" 
                          value={issue.inventory_officer_name_snapshot || buildPersonName(issue.issuedBy)} 
                        />
                        <DetailCard 
                          icon={<Calendar size={14}/>} 
                          label="Transaction Date" 
                          value={formatDateTime(issue.issue_date)} 
                        />
                        <DetailCard
                          icon={<User size={14}/>}
                          label="Supervisor"
                          value={issue.supervisor_name_snapshot || buildPersonName(issue.supervisor)}
                        />
                        <DetailCard
                          icon={<Package size={14}/>}
                          label="Unit Cost"
                          value={toCurrency(issue.unit_cost)}
                        />
                        <DetailCard
                          icon={<Package size={14}/>}
                          label="Total Cost"
                          value={toCurrency(issue.total_cost)}
                        />
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-200 bg-white/50">
                        <div className="flex items-center gap-2">
                            <Package size={12} className="text-slate-400" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">System Log ID</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500">{issue.issue_code || `TXN-INV-${issue.id.toString().padStart(5, '0')}`}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function toCurrency(value?: string | number | null) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "0.00";
  return parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toWorkOrderCode(id?: number | null, createdAt?: string) {
  if (!id) return "WO-UNKNOWN";
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `WO-${year}-${String(id).padStart(3, "0")}`;
}

/* Internal Components */

function DetailCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
      <div className="flex items-center gap-2 mb-2 text-slate-400">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}
