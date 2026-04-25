"use client";

import { useState } from "react";

type Point = { label: string; value: number };

type Props = {
  title: string;
  points: Point[];
};

export default function TrendLineChart({ title, points }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 640;
  const height = 220;
  const pad = 28;
  const max = Math.max(1, ...points.map((p) => p.value), 1);
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;
  const gridLines = 5;
  const chartTop = pad;
  const chartBottom = height - pad - 18;
  const chartHeight = chartBottom - chartTop;

  const coordinates = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = chartBottom - (p.value / max) * chartHeight;
    return { ...p, x, y };
  });
  const d = coordinates.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const activePoint = activeIndex !== null ? coordinates[activeIndex] : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {title ? <p className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">{title}</p> : null}
      {points.length === 0 ? (
        <p className="text-sm font-semibold text-slate-400">No trend data in selected range.</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" onMouseLeave={() => setActiveIndex(null)}>
          <rect x={0} y={0} width={width} height={height} fill="white" />
          <text x={16} y={height / 2} transform={`rotate(-90 16 ${height / 2})`} fill="#64748b" fontSize="10" fontWeight="700">
            Requests
          </text>
          <text x={width / 2} y={height - 2} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="700">
            Month and Day
          </text>
          {Array.from({ length: gridLines }).map((_, idx) => {
            const y = chartTop + (chartHeight / (gridLines - 1)) * idx;
            const tickValue = Math.round(max - (max / (gridLines - 1)) * idx);
            return (
              <g key={`grid-${idx}`}>
                <line
                  x1={pad}
                  x2={width - pad}
                  y1={y}
                  y2={y}
                  stroke="#94a3b8"
                  strokeWidth={1}
                  opacity={0.18}
                />
                <text x={pad - 8} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontWeight="600">
                  {tickValue}
                </text>
              </g>
            );
          })}
          <path d={d} fill="none" stroke="#003366" strokeWidth={3} />
          {coordinates.map((c, idx) => (
            <g key={c.label} onMouseEnter={() => setActiveIndex(idx)}>
              <circle cx={c.x} cy={c.y} r={activeIndex === idx ? 6 : 4} fill="#003366" />
              {activeIndex === idx ? <circle cx={c.x} cy={c.y} r={10} fill="#003366" opacity={0.15} /> : null}
            </g>
          ))}
          {activePoint ? (
            <g>
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={pad}
                y2={chartBottom}
                stroke="#003366"
                strokeDasharray="4 4"
                strokeWidth={1}
                opacity={0.25}
              />
              <rect
                x={Math.min(width - 150, Math.max(8, activePoint.x - 70))}
                y={Math.max(8, activePoint.y - 54)}
                width={140}
                height={42}
                rx={8}
                fill="#0f172a"
                opacity={0.95}
              />
              <text
                x={Math.min(width - 80, Math.max(18, activePoint.x))}
                y={Math.max(24, activePoint.y - 36)}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="10"
                fontWeight="700"
              >
                {activePoint.label}
              </text>
              <text
                x={Math.min(width - 80, Math.max(18, activePoint.x))}
                y={Math.max(40, activePoint.y - 20)}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="14"
                fontWeight="800"
              >
                {activePoint.value}
              </text>
            </g>
          ) : null}
          {coordinates.map((c, idx) => (
            <text
              key={`x-${c.label}-${idx}`}
              x={c.x}
              y={height - 16}
              textAnchor="middle"
              fill="#64748b"
              fontSize="9"
              fontWeight={activeIndex === idx ? "700" : "600"}
              opacity={idx % 2 === 0 || activeIndex === idx ? 0.95 : 0.55}
            >
              {c.label}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
