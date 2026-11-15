import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  area as d3Area,
  curveMonotoneX,
  line as d3Line,
  pointer as d3Pointer,
  scaleLinear,
  scalePoint,
} from 'd3';
import { ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react';
import type {
  DisciplineSessionPoint,
  DisciplineTrendSeries,
} from '../lib/progressAnalytics';
import { formatShortDate } from '../lib/storage';

interface DisciplineAccuracyLineChartProps {
  series: DisciplineTrendSeries;
  showRealRetention: boolean;
  onOpenSession: (sessionId: string) => void;
}

const CHART_HEIGHT = 216;
const MARGIN = { top: 14, right: 16, bottom: 28, left: 38 };

export function DisciplineAccuracyLineChart({
  series,
  showRealRetention,
  onOpenSession,
}: DisciplineAccuracyLineChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(420);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gradientId = useId().replace(/:/g, '');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const next = Math.max(220, Math.floor(el.getBoundingClientRect().width));
      setContainerWidth(next);
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerWidth = Math.max(120, containerWidth - MARGIN.left - MARGIN.right);
  const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const {
    yScale,
    yTicks,
    rawLinePath,
    rawAreaPath,
    realLinePath,
    plottedPoints,
  } = useMemo(() => {
    const x = scalePoint<number>()
      .domain(series.points.map((p) => p.sessionIndex))
      .range([0, innerWidth])
      .padding(series.points.length === 1 ? 0.5 : 0.2);

    const y = scaleLinear().domain([0, 100]).range([innerHeight, 0]);
    const ticks = [0, 25, 50, 75, 100];

    const rawLineGen = d3Line<DisciplineSessionPoint>()
      .x((d) => x(d.sessionIndex) ?? 0)
      .y((d) => y(d.rawAccuracyPct))
      .curve(curveMonotoneX);

    const rawAreaGen = d3Area<DisciplineSessionPoint>()
      .x((d) => x(d.sessionIndex) ?? 0)
      .y0(innerHeight)
      .y1((d) => y(d.rawAccuracyPct))
      .curve(curveMonotoneX);

    const realLineGen = d3Line<DisciplineSessionPoint>()
      .x((d) => x(d.sessionIndex) ?? 0)
      .y((d) => y(d.realRetentionPct))
      .curve(curveMonotoneX);

    const pts = series.points.map((pt) => ({
      point: pt,
      cx: x(pt.sessionIndex) ?? 0,
      cyRaw: y(pt.rawAccuracyPct),
      cyReal: y(pt.realRetentionPct),
    }));

    return {
      yScale: y,
      yTicks: ticks,
      rawLinePath: series.points.length >= 2 ? rawLineGen(series.points) || '' : '',
      rawAreaPath: series.points.length >= 2 ? rawAreaGen(series.points) || '' : '',
      realLinePath: series.points.length >= 2 ? realLineGen(series.points) || '' : '',
      plottedPoints: pts,
    };
  }, [series.points, innerWidth, innerHeight]);

  const activePoint =
    hoveredIndex !== null && plottedPoints[hoveredIndex]
      ? plottedPoints[hoveredIndex]
      : null;

  const displayPoint = activePoint?.point ?? series.points[series.points.length - 1];

  const handleSvgPointerMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (plottedPoints.length === 0) return;
    const [mx] = d3Pointer(e.nativeEvent);
    let nearestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    plottedPoints.forEach((item, idx) => {
      const dist = Math.abs(item.cx - mx);
      if (dist < bestDist) {
        bestDist = dist;
        nearestIdx = idx;
      }
    });
    setHoveredIndex(nearestIdx);
  };

  const deltaPositive = series.deltaAccuracyPct > 0;
  const deltaNegative = series.deltaAccuracyPct < 0;

  return (
    <article className="bg-white dark:bg-[#22201D] border border-[#E5E0D8] dark:border-[#36332E] rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#EFECE6] truncate">
            {series.discipline}
          </h3>
          <p className="mt-0.5 text-xs text-[#44403C] dark:text-[#C2BCB2] tabular-nums">
            Últimas {series.points.length} de {series.totalSessionsInDiscipline} sessão(ões) · Média {series.averageAccuracyPct}%
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="font-mono text-lg font-semibold tabular-nums text-[#18181B] dark:text-[#EFECE6]">
            {series.latestAccuracyPct}%
          </p>
          <p className="text-xs font-mono tabular-nums flex items-center justify-end gap-1 text-[#44403C] dark:text-[#C2BCB2]">
            {series.points.length >= 2 ? (
              <>
                {deltaPositive && (
                  <TrendingUp className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
                )}
                {deltaNegative && (
                  <TrendingDown className="w-3.5 h-3.5 text-[#B91C1C] dark:text-[#F87171]" aria-hidden="true" />
                )}
                <span
                  className={
                    deltaPositive
                      ? 'text-[#047857] dark:text-[#34D399]'
                      : deltaNegative
                        ? 'text-[#B91C1C] dark:text-[#F87171]'
                        : ''
                  }
                >
                  {series.deltaAccuracyPct > 0 ? `+${series.deltaAccuracyPct}` : series.deltaAccuracyPct} p.p. no recorte
                </span>
              </>
            ) : (
              <span>1 sessão registrada</span>
            )}
          </p>
        </div>
      </div>

      <div ref={containerRef} className="w-full relative overflow-hidden">
        <svg
          width={containerWidth}
          height={CHART_HEIGHT}
          role="img"
          aria-label={`Gráfico de linha da taxa de acerto em ${series.discipline} nas últimas ${series.points.length} sessões`}
          className="select-none block"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D97706" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {yTicks.map((tick) => {
              const yPos = yScale(tick);
              return (
                <g key={tick} transform={`translate(0,${yPos})`}>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={0}
                    y2={0}
                    className={
                      tick === 0
                        ? 'stroke-[#D6D0C6] dark:stroke-[#45413B]'
                        : 'stroke-[#E5E0D8] dark:stroke-[#36332E]'
                    }
                    strokeDasharray={tick === 0 ? undefined : '3 3'}
                    strokeWidth={1}
                  />
                  <text
                    x={-8}
                    y={0}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-[#57534E] dark:fill-[#C2BCB2] font-mono text-[10px] tabular-nums"
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}

            {rawAreaPath && <path d={rawAreaPath} fill={`url(#${gradientId})`} />}

            {showRealRetention && realLinePath && (
              <path
                d={realLinePath}
                fill="none"
                className="stroke-[#047857] dark:stroke-[#34D399]"
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            )}

            {rawLinePath && (
              <path
                d={rawLinePath}
                fill="none"
                className="stroke-[#B45309] dark:stroke-[#F59E0B]"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {activePoint && (
              <line
                x1={activePoint.cx}
                x2={activePoint.cx}
                y1={0}
                y2={innerHeight}
                className="stroke-[#57534E]/60 dark:stroke-[#C2BCB2]/50"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
            )}

            {plottedPoints.map(({ point, cx }) => {
              const isHighlighted = activePoint?.point.sessionId === point.sessionId;
              return (
                <g key={point.sessionId} transform={`translate(${cx},${innerHeight})`}>
                  <line
                    y1={0}
                    y2={4}
                    className="stroke-[#D6D0C6] dark:stroke-[#45413B]"
                    strokeWidth={1}
                  />
                  <text
                    y={16}
                    textAnchor="middle"
                    className={`font-mono text-[10px] tabular-nums ${
                      isHighlighted
                        ? 'fill-[#18181B] dark:fill-[#EFECE6] font-semibold'
                        : 'fill-[#57534E] dark:fill-[#C2BCB2]'
                    }`}
                  >
                    S{point.sessionIndex}
                  </text>
                </g>
              );
            })}

            {plottedPoints.map(({ point, cx, cyRaw, cyReal }, idx) => {
              const isHighlighted = activePoint?.point.sessionId === point.sessionId;
              return (
                <g key={point.sessionId}>
                  {showRealRetention && (
                    <circle
                      cx={cx}
                      cy={cyReal}
                      r={isHighlighted ? 4.5 : 3}
                      className="fill-[#FAF8F5] dark:fill-[#22201D] stroke-[#047857] dark:stroke-[#34D399]"
                      strokeWidth={2}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cyRaw}
                    r={isHighlighted ? 5.5 : 4}
                    tabIndex={0}
                    role="button"
                    aria-label={`Sessão ${point.sessionIndex}: ${point.title}, ${point.rawAccuracyPct}% de acerto`}
                    onFocus={() => setHoveredIndex(idx)}
                    onBlur={() => setHoveredIndex(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpenSession(point.sessionId);
                      }
                    }}
                    className="fill-[#B45309] dark:fill-[#F59E0B] stroke-white dark:stroke-[#22201D] cursor-pointer focus:outline-none"
                    strokeWidth={2}
                  />
                </g>
              );
            })}

            <rect
              x={0}
              y={0}
              width={innerWidth}
              height={innerHeight}
              fill="transparent"
              className="cursor-crosshair"
              onMouseMove={handleSvgPointerMove}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => {
                if (activePoint) {
                  onOpenSession(activePoint.point.sessionId);
                }
              }}
            />
          </g>
        </svg>
      </div>

      <div className="pt-3 border-t border-[#E5E0D8] dark:border-[#36332E] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="min-w-0 space-y-0.5 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[#44403C] dark:text-[#C2BCB2]">
            <span className="font-mono font-semibold text-[#18181B] dark:text-[#EFECE6] tabular-nums">
              S{displayPoint.sessionIndex}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[220px] sm:max-w-[260px] font-medium text-[#18181B] dark:text-[#EFECE6]">
              {displayPoint.title}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatShortDate(displayPoint.dateIso)}</span>
          </div>
          <p className="font-mono tabular-nums text-xs text-[#44403C] dark:text-[#C2BCB2]">
            Acerto: {displayPoint.rawAccuracyPct}% ({displayPoint.rawCorrectCount}/{displayPoint.questionsEvaluated})
            {showRealRetention &&
              ` · Retenção real: ${displayPoint.realRetentionPct}%`}
            {displayPoint.guessHitsCount > 0 &&
              ` · ${displayPoint.guessHitsCount} chute(s)`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenSession(displayPoint.sessionId)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] dark:text-[#F59E0B] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Abrir sessão</span>
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
