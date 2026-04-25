"use client";

type Item = { name: string; value: number; subtitle?: string };

type Props = {
  title: string;
  items: Item[];
  max?: number;
  valueFormatter?: (value: number) => string;
};

export default function SimpleBarChart({ title, items, max, valueFormatter }: Props) {
  const peak = max ?? Math.max(1, ...items.map((i) => i.value), 1);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">{title}</p>
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm font-semibold text-slate-400">No data in selected range.</p>}
        {items.map((item) => (
          <div key={item.name} className="rounded-xl border border-slate-100 p-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-bold text-slate-700">{item.name}</span>
              <span className="font-black text-slate-900">{valueFormatter ? valueFormatter(item.value) : item.value}</span>
            </div>
            {item.subtitle && <p className="mb-1 text-[11px] font-bold text-slate-500">{item.subtitle}</p>}
            <div className="h-2 rounded bg-slate-100">
              <div
                className="h-2 rounded bg-[#003366]"
                style={{ width: `${Math.max(4, (item.value / peak) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

