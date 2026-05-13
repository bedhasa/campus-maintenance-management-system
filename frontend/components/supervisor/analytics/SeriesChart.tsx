"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import ChartFrame from "./ChartFrame";

type Point = {
  label: string;
  value: number;
};

type Series = {
  name: string;
  color: string;
  points: Point[];
  fill?: boolean;
};

type Props = {
  title: string;
  subtitle?: string;
  series: Series[];
  yLabel?: string;
  footer?: ReactNode;
};

export default function SeriesChart({ title, subtitle, series, yLabel = "Requests", footer }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 760;
  const height = 300;
  const padX = 46;
  const padTop = 20;
  const padBottom = 44;
  const chartHeight = height - padTop - padBottom;
  const labels = series[0]?.points.map((point) => point.label) ?? [];
  const maxValue = Math.max(1, ...series.flatMap((item) => item.points.map((point) => point.value)), 1);
  const stepX = labels.length > 1 ? (width - padX * 2) / (labels.length - 1) : 0;

  const mapped = series.map((item) => ({
    ...item,
    coords: item.points.map((point, index) => ({
      ...point,
      x: padX + index * stepX,
      y: padTop + chartHeight - (point.value / maxValue) * chartHeight,
    })),
  }));

  const activeLabel = activeIndex !== null ? labels[activeIndex] : null;

  return (
    <ChartFrame title={title} subtitle={subtitle} footer={footer}>
      {labels.length === 0 ? (
        <p className="text-sm font-semibold text-slate-400">No trend data available for the selected period.</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-72 w-full"
          onMouseLeave={() => setActiveIndex(null)}
        >
          {Array.from({ length: 5 }).map((_, index) => {
            const y = padTop + (chartHeight / 4) * index;
            const tick = Math.round(maxValue - (maxValue / 4) * index);
            return (
              <g key={`grid-${index}`}>
                <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#cbd5e1" strokeWidth="1" opacity="0.45" />
                <text x={padX - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10" fontWeight="700">
                  {tick}
                </text>
              </g>
            );
          })}

          <text
            x={18}
            y={height / 2}
            transform={`rotate(-90 18 ${height / 2})`}
            fill="#64748b"
            fontSize="10"
            fontWeight="700"
          >
            {yLabel}
          </text>

          {mapped.map((item) => {
            const line = item.coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`).join(" ");
            const area = `${line} L ${item.coords[item.coords.length - 1]?.x ?? padX} ${height - padBottom} L ${item.coords[0]?.x ?? padX} ${height - padBottom} Z`;

            return (
              <g key={item.name}>
                {item.fill ? <path d={area} fill={item.color} opacity="0.12" /> : null}
                <path d={line} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {item.coords.map((coord, index) => (
                  <g key={`${item.name}-${coord.label}`}>
                    <circle
                      cx={coord.x}
                      cy={coord.y}
                      r={activeIndex === index ? 5 : 3.5}
                      fill={item.color}
                      onMouseEnter={() => setActiveIndex(index)}
                      className="cursor-pointer transition-all duration-200"
                    />
                    {activeIndex === index ? <circle cx={coord.x} cy={coord.y} r={10} fill={item.color} opacity="0.12" /> : null}
                  </g>
                ))}
              </g>
            );
          })}

          {activeIndex !== null ? (
            <line
              x1={padX + activeIndex * stepX}
              y1={padTop}
              x2={padX + activeIndex * stepX}
              y2={height - padBottom}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ) : null}

          {labels.map((label, index) => (
            <text
              key={label}
              x={padX + index * stepX}
              y={height - 18}
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              fontWeight={activeIndex === index ? "800" : "700"}
              opacity={activeIndex === null || activeIndex === index || index % 2 === 0 ? 0.95 : 0.55}
            >
              {label}
            </text>
          ))}

          {activeLabel ? (
            <g>
              <rect x={width - 208} y={16} width={188} height={24 + mapped.length * 18} rx={14} fill="#0f172a" opacity="0.96" />
              <text x={width - 114} y={34} textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="800">
                {activeLabel}
              </text>
              {mapped.map((item, idx) => {
                const value = item.points[activeIndex ?? 0]?.value ?? 0;
                return (
                  <g key={`legend-${item.name}`}>
                    <circle cx={width - 190} cy={49 + idx * 18} r={4} fill={item.color} />
                    <text x={width - 180} y={53 + idx * 18} fill="#e2e8f0" fontSize="10" fontWeight="700">
                      {item.name}: {value}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}
        </svg>
      )}

      {mapped.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {mapped.map((item) => (
            <div key={item.name} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs font-black text-slate-700">{item.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </ChartFrame>
  );
}
