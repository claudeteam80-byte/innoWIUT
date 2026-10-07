import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { SelectField } from '@/components/ui/Field';
import { Tabs } from '@/components/ui/Tabs';
import { formatDate } from '@/domain/dates';
import { formatCompact, formatMetricValue } from '@/domain/format';
import { buildSeries, CHART_PERIODS, niceTicks, type ChartPeriod } from '@/domain/series';
import type { Entry, Metric } from '../api';

const HEIGHT = 240;
const MARGIN = { top: 20, right: 20, bottom: 30, left: 48 };

/** Single-series line chart of one metric's recorded history. */
export function TractionChart({ metrics, entries }: { metrics: Metric[]; entries: Entry[] }) {
  const [metricId, setMetricId] = useState(metrics[0]?.id ?? '');
  const [period, setPeriod] = useState<ChartPeriod>('3m');
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];
  const series = useMemo(
    () => (metric ? buildSeries(entries, metric.id, period) : []),
    [entries, metric, period],
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SelectField
          label="Metric"
          className="sm:w-60"
          value={metric?.id ?? ''}
          onChange={(event) => setMetricId(event.target.value)}
          options={metrics.map((m) => ({ value: m.id, label: m.name }))}
        />
        <Tabs
          label="Chart period"
          value={period}
          onChange={setPeriod}
          tabs={CHART_PERIODS}
          size="sm"
        />
      </div>
      {metric && series.length === 0 && (
        <p className="grid h-[180px] place-items-center rounded-lg bg-canvas text-center text-[13px] text-muted">
          No values recorded for {metric.name} in this period.
        </p>
      )}
      {metric && series.length > 0 && <LineChart metric={metric} points={series} />}
      {metric && series.length === 1 && (
        <p className="mt-2 text-center text-[12px] text-muted">
          Record another value on a later date to see a trend line.
        </p>
      )}
    </div>
  );
}

function LineChart({
  metric,
  points,
}: {
  metric: Metric;
  points: { date: Date; value: number }[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0] ?? 0;
  const yMax = ticks.at(-1) ?? 1;
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const first = points[0]!.date.getTime();
  const last = points.at(-1)!.date.getTime();
  const x = (date: Date) =>
    MARGIN.left +
    (last === first ? innerWidth / 2 : ((date.getTime() - first) / (last - first)) * innerWidth);
  const y = (value: number) =>
    MARGIN.top + innerHeight - ((value - yMin) / (yMax - yMin || 1)) * innerHeight;

  const coords = points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.value) }));
  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.cx},${c.cy}`).join(' ');
  const area =
    coords.length > 1
      ? `${line} L${coords.at(-1)!.cx},${y(yMin)} L${coords[0]!.cx},${y(yMin)} Z`
      : '';
  const end = coords.at(-1)!;
  const hovered = active !== null ? coords[active] : null;
  const format = (value: number) => formatMetricValue(value, metric.unit, metric.currency);

  function nearestIndex(clientX: number) {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return null;
    const px = clientX - box.left;
    let best = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.cx - px) < Math.abs(coords[best]!.cx - px)) best = i;
    });
    return best;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setActive((current) => {
      const start = current ?? coords.length - 1;
      return event.key === 'ArrowLeft'
        ? Math.max(0, start - 1)
        : Math.min(coords.length - 1, start + 1);
    });
  }

  const summary = `${metric.name}: ${points.length} value${points.length === 1 ? '' : 's'} from ${formatDate(points[0]!.date)} to ${formatDate(end.date)}, latest ${format(end.value)}. Use the left and right arrow keys to read values.`;

  return (
    <div
      ref={containerRef}
      className="relative touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      role="img"
      aria-label={summary}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onBlur={() => setActive(null)}
      onPointerMove={(event: PointerEvent) => setActive(nearestIndex(event.clientX))}
      onPointerLeave={() => setActive(null)}
    >
      <svg width={width} height={HEIGHT} className="block max-w-full" aria-hidden="true">
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              fontSize={11}
              fill="var(--color-muted)"
            >
              {formatCompact(tick)}
            </text>
          </g>
        ))}
        <text
          x={coords[0]!.cx}
          y={HEIGHT - 8}
          fontSize={11}
          fill="var(--color-muted)"
          textAnchor={coords.length > 1 ? 'start' : 'middle'}
        >
          {formatDate(points[0]!.date)}
        </text>
        {coords.length > 1 && (
          <text x={end.cx} y={HEIGHT - 8} fontSize={11} fill="var(--color-muted)" textAnchor="end">
            {formatDate(end.date)}
          </text>
        )}
        {area && <path d={area} fill="var(--color-primary)" opacity={0.1} />}
        {coords.length > 1 && (
          <path
            d={line}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {hovered && (
          <line
            x1={hovered.cx}
            x2={hovered.cx}
            y1={MARGIN.top}
            y2={MARGIN.top + innerHeight}
            stroke="var(--color-line-strong)"
            strokeWidth={1}
          />
        )}
        <circle
          cx={end.cx}
          cy={end.cy}
          r={4}
          fill="var(--color-primary)"
          stroke="white"
          strokeWidth={2}
        />
        {hovered && hovered !== end && (
          <circle
            cx={hovered.cx}
            cy={hovered.cy}
            r={4}
            fill="var(--color-primary)"
            stroke="white"
            strokeWidth={2}
          />
        )}
        {!hovered && (
          <text
            x={end.cx}
            y={end.cy - 10}
            textAnchor={coords.length > 1 ? 'end' : 'middle'}
            fontSize={12}
            fontWeight={600}
            fill="var(--color-ink)"
          >
            {format(end.value)}
          </text>
        )}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-white px-3 py-2 text-[12px] shadow-card"
          style={{
            left: Math.min(Math.max(hovered.cx - 70, 0), width - 150),
          }}
        >
          <p className="text-[13px] font-semibold text-ink">{format(hovered.value)}</p>
          <p className="text-muted">
            <span className="mr-1.5 inline-block h-0.5 w-3 rounded bg-primary align-middle" />
            {formatDate(hovered.date)}
          </p>
        </div>
      )}
    </div>
  );
}
