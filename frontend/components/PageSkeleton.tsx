type PageSkeletonProps = {
  cards?: number;
  rows?: number;
  title?: string;
};

type ListSkeletonProps = {
  rows?: number;
  className?: string;
};

type TableRowsSkeletonProps = {
  rows?: number;
  cols?: number;
  cellClassName?: string;
};

const BASE = "animate-pulse rounded-xl bg-slate-200/70";

export default function PageSkeleton({ cards = 4, rows = 4, title }: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      {title ? <div className={`${BASE} h-8 w-64`} aria-label={title} /> : <div className={`${BASE} h-8 w-64`} />}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className={`${BASE} h-3 w-24`} />
            <div className={`${BASE} h-8 w-16`} />
          </div>
        ))}
      </div>
      <ListSkeleton rows={rows} />
    </div>
  );
}

export function ListSkeleton({ rows = 4, className = "space-y-3" }: ListSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
          <div className={`${BASE} h-4 w-2/5`} />
          <div className={`${BASE} h-3 w-1/4`} />
        </div>
      ))}
    </div>
  );
}

export function TableRowsSkeleton({ rows = 4, cols = 5, cellClassName = "px-8 py-6" }: TableRowsSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-gray-50">
          {Array.from({ length: cols }).map((_, cellIndex) => (
            <td key={`${rowIndex}-${cellIndex}`} className={cellClassName}>
              <div className={`${BASE} h-4 ${cellIndex === cols - 1 ? "w-10 ml-auto" : "w-24"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
