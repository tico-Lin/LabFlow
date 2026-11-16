// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useEffect, useRef, useState } from 'react';

export interface ChartSeries {
  id: string;
  label: string;
  x: number[];
  y: number[];
  color: string;
  dashed?: boolean;
  lineWidth?: number;
  fillAlpha?: number;
}

interface ScientificCanvasProps {
  title: string;
  xLabel: string;
  yLabel: string;
  series: ChartSeries[];
  invertX?: boolean; // e.g., XPS / NMR descending chemical shift or binding energy
  height?: number;
  testId?: string;
}

export const ScientificCanvas: React.FC<ScientificCanvasProps> = ({
  title,
  xLabel,
  yLabel,
  series,
  invertX = false,
  height = 360,
  testId = 'scientific-canvas',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{
    x: number;
    y: number;
    px: number;
    py: number;
    seriesLabel: string;
  } | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const visibleSeries = series.filter((s) => !hiddenIds.has(s.id) && s.x.length > 0);

  // Compute bounds
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const s of visibleSeries) {
    for (let i = 0; i < s.x.length; i++) {
      const xv = s.x[i];
      const yv = s.y[i];
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
      if (xv < xMin) xMin = xv;
      if (xv > xMax) xMax = xv;
      if (yv < yMin) yMin = yv;
      if (yv > yMax) yMax = yv;
    }
  }
  if (!Number.isFinite(xMin) || xMin === xMax) {
    xMin = 0;
    xMax = 1;
  }
  if (!Number.isFinite(yMin) || yMin === yMax) {
    yMin = 0;
    yMax = 1;
  }
  const yPad = (yMax - yMin) * 0.08 || 0.1;
  yMin -= yPad;
  yMax += yPad;

  const pad = { top: 24, right: 24, bottom: 44, left: 66 };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(320, container.clientWidth);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = isDark ? '#0b1120' : '#ffffff';
    const gridColor = isDark ? 'rgba(148,163,184,0.14)' : 'rgba(15,23,42,0.08)';
    const axisColor = isDark ? '#475569' : '#94a3b8';
    const textColor = isDark ? '#cbd5e1' : '#334155';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const mapX = (xv: number) => {
      const norm = (xv - xMin) / (xMax - xMin);
      return pad.left + (invertX ? 1 - norm : norm) * plotW;
    };
    const mapY = (yv: number) => pad.top + (1 - (yv - yMin) / (yMax - yMin)) * plotH;

    // Grid & ticks
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = textColor;

    const xTicks = 5;
    for (let i = 0; i <= xTicks; i++) {
      const frac = i / xTicks;
      const val = invertX ? xMax - frac * (xMax - xMin) : xMin + frac * (xMax - xMin);
      const px = pad.left + frac * plotW;
      ctx.beginPath();
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, pad.top + plotH);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(Math.abs(val) >= 1000 ? val.toExponential(1) : val.toPrecision(4).replace(/\.?0+$/, ''), px, pad.top + plotH + 16);
    }

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const frac = i / yTicks;
      const val = yMax - frac * (yMax - yMin);
      const py = pad.top + frac * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.left, py);
      ctx.lineTo(pad.left + plotW, py);
      ctx.stroke();
      ctx.textAlign = 'right';
      const formatted =
        Math.abs(val) > 0 && (Math.abs(val) < 0.01 || Math.abs(val) >= 10000)
          ? val.toExponential(1)
          : val.toFixed(2);
      ctx.fillText(formatted, pad.left - 8, py + 4);
    }

    // Plot box border
    ctx.strokeStyle = axisColor;
    ctx.strokeRect(pad.left, pad.top, plotW, plotH);

    // Axis titles
    ctx.fillStyle = textColor;
    ctx.font = '11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, pad.left + plotW / 2, height - 6);
    ctx.save();
    ctx.translate(14, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Clip to plot box and draw series
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, plotW, plotH);
    ctx.clip();

    for (const s of visibleSeries) {
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.lineWidth ?? 1.8;
      if (s.dashed) ctx.setLineDash([6, 4]);

      ctx.beginPath();
      let started = false;
      for (let i = 0; i < s.x.length; i++) {
        const px = mapX(s.x[i]);
        const py = mapY(s.y[i]);
        if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      if (s.fillAlpha && s.fillAlpha > 0 && s.x.length > 1) {
        ctx.lineTo(mapX(s.x[s.x.length - 1]), mapY(0));
        ctx.lineTo(mapX(s.x[0]), mapY(0));
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.fillAlpha;
        ctx.fill();
      }
      ctx.restore();
    }

    // Crosshair hover marker
    if (hoverPoint) {
      ctx.strokeStyle = isDark ? 'rgba(56,189,248,0.65)' : 'rgba(37,99,235,0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverPoint.px, pad.top);
      ctx.lineTo(hoverPoint.px, pad.top + plotH);
      ctx.moveTo(pad.left, hoverPoint.py);
      ctx.lineTo(pad.left + plotW, hoverPoint.py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(hoverPoint.px, hoverPoint.py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }, [series, hiddenIds, hoverPoint, invertX, height, xLabel, yLabel]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || visibleSeries.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const width = rect.width;
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    let bestDist = Infinity;
    let best: typeof hoverPoint = null;
    for (const s of visibleSeries) {
      for (let i = 0; i < s.x.length; i++) {
        const norm = (s.x[i] - xMin) / (xMax - xMin);
        const px = pad.left + (invertX ? 1 - norm : norm) * plotW;
        const py = pad.top + (1 - (s.y[i] - yMin) / (yMax - yMin)) * plotH;
        const dist = Math.hypot(px - mx, py - my);
        if (dist < bestDist) {
          bestDist = dist;
          best = { x: s.x[i], y: s.y[i], px, py, seriesLabel: s.label };
        }
      }
    }
    setHoverPoint(bestDist < 42 ? best : null);
  };

  const toggleSeries = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportSvg = () => {
    const w = 720;
    const h = 420;
    const pW = w - pad.left - pad.right;
    const pH = h - pad.top - pad.bottom;
    const paths = visibleSeries
      .map((s) => {
        const d = s.x
          .map((xv, i) => {
            const norm = (xv - xMin) / (xMax - xMin);
            const px = (pad.left + (invertX ? 1 - norm : norm) * pW).toFixed(2);
            const py = (pad.top + (1 - (s.y[i] - yMin) / (yMax - yMin)) * pH).toFixed(2);
            return `${i === 0 ? 'M' : 'L'}${px},${py}`;
          })
          .join(' ');
        return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="1.8" ${
          s.dashed ? 'stroke-dasharray="6 4"' : ''
        } />`;
      })
      .join('\n  ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#ffffff"/>
  <g id="layer_axes">
    <rect x="${pad.left}" y="${pad.top}" width="${pW}" height="${pH}" fill="none" stroke="#334155" stroke-width="1.2"/>
    <text x="${w / 2}" y="${h - 10}" text-anchor="middle" font-size="12" font-family="sans-serif">${xLabel}</text>
  </g>
  <g id="layer_curves">
  ${paths}
  </g>
</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {hoverPoint && (
            <span className="font-mono text-xs tabular-nums text-cyan-700 dark:text-cyan-400">
              {hoverPoint.seriesLabel} · X={hoverPoint.x.toFixed(4)} · Y={hoverPoint.y.toFixed(4)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {series.map((s) => {
              const hidden = hiddenIds.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSeries(s.id)}
                  className={`flex items-center gap-1.5 border px-2 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    hidden
                      ? 'border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600'
                      : 'border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  <span
                    className="inline-block h-2 w-3"
                    style={{ backgroundColor: hidden ? '#94a3b8' : s.color }}
                  />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={exportSvg}
            className="border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Export SVG
          </button>
        </div>
      </div>
      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          data-testid={testId}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverPoint(null)}
          className="block w-full cursor-crosshair"
        />
      </div>
    </div>
  );
};
