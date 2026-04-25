"use client";

type Props = {
  label: string;
  value: number;
  percentage: number;
  active?: boolean;
  onClick?: () => void;
};

export default function KpiCard({ label, value, percentage, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-colors ${
        active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className="text-xs font-bold text-slate-500">{percentage}%</p>
    </button>
  );
}

