import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, ChevronDown, ChevronUp, ClipboardCheck, ExternalLink } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, Legend, CartesianGrid,
} from 'recharts';
import { format } from 'date-fns';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { ComparisonView } from './ComparisonView';
import { useFvTrendData, type UnscoredIntro } from '@/hooks/useFvTrendData';
import {
  type DatePreset,
  type DateRange,
  getDateRangeForPreset,
  getCurrentPayPeriod,
} from '@/lib/pay-period';
import {
  cadenceDotStatus,
  buildTrendPoints,
  pickBucketSize,
  applyMovingAverage,
  type EvalPrimary,
  type TrendPoint,
} from '@/lib/scorecard/trends';
import type { FvScorecard } from '@/hooks/useScorecards';
import { CoachStreakBadges } from './CoachStreakBadges';
import { UnscoredDrillDown } from './UnscoredDrillDown';
import { colorForCoach } from '@/lib/scorecard/coachColors';

const STUDIO_KEY = '__studio__';
const STUDIO_COLOR = 'hsl(20 90% 47%)'; // OTF orange — reserved for studio overall

type ChartMode = 'avg' | 'closed';

export function WigFirstVisitSection({ dateRange: _ignored }: { dateRange?: DateRange }) {
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const range = useMemo(() => getDateRangeForPreset(preset, customRange) || getCurrentPayPeriod(), [preset, customRange]);

  const [smoothed, setSmoothed] = useState(false);
  const [primary, setPrimary] = useState<EvalPrimary>('self');
  const [chartMode, setChartMode] = useState<ChartMode>('avg');
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<{ label: string; cards: FvScorecard[] } | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [unscoredFor, setUnscoredFor] = useState<{ coach: string; intros: UnscoredIntro[] } | null>(null);
  const navigate = useNavigate();

  const { data, isLoading } = useFvTrendData(range, primary, smoothed);
  const hasAnyScorecards = data.scorecards.length > 0;
  const hasAnyRan = data.ranByCoach.size > 0;
  const isEmptyRange = !isLoading && !hasAnyScorecards && !hasAnyRan;

  // Count submitted scorecards of the active primary type — drives empty state.
  const primaryTypeCount = useMemo(() => {
    const t = primary === 'self' ? 'self_eval' : 'formal_eval';
    return data.scorecards.filter(s => s.submitted_at && s.eval_type === t).length;
  }, [data.scorecards, primary]);

  // Per-coach closed/not-closed cards & trend points (Closed chart mode).
  const closedByCoach = useMemo(() => {
    const map = new Map<string, FvScorecard[]>();
    data.closedCards.forEach(c => {
      const k = c.evaluatee_name || 'Unknown';
      const arr = map.get(k) || [];
      arr.push(c);
      map.set(k, arr);
    });
    return map;
  }, [data.closedCards]);

  const perCoachClosedPoints = useMemo(() => {
    const size = pickBucketSize(range);
    const out = new Map<string, TrendPoint[]>();
    closedByCoach.forEach((cards, coach) => {
      let pts = buildTrendPoints(cards, range, size);
      if (smoothed) pts = applyMovingAverage(pts, 4);
      out.set(coach, pts);
    });
    return out;
  }, [closedByCoach, range, smoothed]);

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };


  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          First Visit Experience
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Every coach's first visits, scored. Tap a coach in the legend to isolate. Tap a point to open the scorecards behind it.
        </p>
        <div className="pt-2">
          <DateRangeFilter
            preset={preset}
            customRange={customRange}
            onPresetChange={setPreset}
            onCustomRangeChange={setCustomRange}
            dateRange={range}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Chart toggle row */}
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={smoothed ? 'avg' : 'raw'}
            onChange={v => setSmoothed(v === 'avg')}
            options={[
              { value: 'raw', label: 'Raw' },
              { value: 'avg', label: '4-week avg' },
            ]}
          />
          <ToggleGroup
            value={primary}
            onChange={v => setPrimary(v as EvalPrimary)}
            options={[
              { value: 'self', label: 'Self Evals' },
              { value: 'formal', label: 'Formal Evals' },
            ]}
          />
          {hasAnyRan && (
            <Badge variant="outline" className="ml-auto text-[10px]">
              {data.unscoredCount} {data.unscoredCount === 1 ? 'intro' : 'intros'} still waiting on a scorecard
            </Badge>
          )}
        </div>


        {isLoading ? (
          <LoadingState />
        ) : isEmptyRange ? (
          <EmptyState onScoreFirst={() => navigate('/scorecards/me')} />
        ) : (
          <>
            {/* Multi-coach trend chart with mode tabs */}
            <Card className="p-3 border-border/60">
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <ToggleGroup
                  value={chartMode}
                  onChange={v => setChartMode(v as ChartMode)}
                  options={[
                    { value: 'avg', label: 'Avg Score' },
                    { value: 'closed', label: 'Avg Score · Closed' },
                  ]}
                />
                <span className="text-[10px] text-muted-foreground">Avg score / 30</span>
              </div>
              {primaryTypeCount === 0 ? (
                <div className="py-8 text-center space-y-1">
                  <ClipboardCheck className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                  <p className="text-sm font-semibold">
                    No {primary === 'self' ? 'self' : 'formal'} evals in this range yet.
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    The first scorecard starts the trend.
                  </p>
                </div>
              ) : (
                <MultiCoachTrendChart
                  primary={primary}
                  studioPoints={chartMode === 'avg' ? data.studioPoints : data.closedPoints}
                  perCoachPoints={chartMode === 'avg' ? data.perCoachPoints : perCoachClosedPoints}
                  hidden={hiddenSeries}
                  onToggleSeries={toggleSeries}
                  onPointTap={(seriesKey, seriesLabel, point) => {
                    let cards = point.scorecards;
                    if (seriesKey !== STUDIO_KEY) {
                      cards = cards.filter(c => c.evaluatee_name === seriesKey);
                    }
                    setDrilldown({
                      label: `${seriesLabel} · ${point.bucket}${chartMode === 'closed' ? ' · closed' : ''}`,
                      cards,
                    });
                  }}
                />
              )}
            </Card>

            {/* Closing-score tiles */}
            <ClosingTiles
              tiles={data.closingTiles}
              onTapClosed={() => setDrilldown({ label: `Closed · avg score`, cards: data.closedCards })}
              onTapNotClosed={() => setDrilldown({ label: `Didn't close · avg score`, cards: data.notClosedCards })}
              onTapCoverage={(bucket) => {
                if (bucket === 'formal') setDrilldown({ label: 'Coverage · formal eval', cards: data.coverageCards.formal });
                else if (bucket === 'selfOnly') setDrilldown({ label: 'Coverage · self eval only', cards: data.coverageCards.selfOnly });
                else setUnscoredFor({ coach: 'Studio', intros: data.unscoredIntros });
              }}
            />

            {/* Coach leaderboard */}
            <div>
              <h3 className="text-sm font-bold mb-2">Coach leaderboard</h3>
              {data.ranByCoach.size === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  No first intros ran in this range yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {[...data.ranByCoach.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .map(([coach, ran]) => {
                      const formal = data.formalByCoach.get(coach);
                      const self = data.selfByCoach.get(coach);
                      const gap = formal?.avg !== undefined && formal?.avg !== null && self?.avg !== undefined && self?.avg !== null
                        ? formal.avg - self.avg : null;
                      const dot = cadenceDotStatus(coach, data.scorecards);
                      const unscored = data.unscoredByCoach.get(coach) || 0;
                      const expanded = expandedCoach === coach;
                      const coachPoints = data.perCoachPoints.get(coach) || [];
                      return (
                        <div key={coach} className="rounded-md border border-border bg-card overflow-hidden">
                          <div className="flex items-center gap-1 px-2 py-1.5 min-h-[44px]">
                            <CadenceDot status={dot} />
                            {/* Coach name → routes to detail page */}
                            <button
                              type="button"
                              onClick={() => navigate(`/coaches/${encodeURIComponent(coach)}`)}
                              className="flex-1 min-w-0 text-left px-2 py-1 rounded hover:bg-muted/50 cursor-pointer group"
                              title={`Open ${coach}'s coach page`}
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-semibold truncate text-primary group-hover:underline">{coach}</span>
                                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100" />
                                <CoachStreakBadges coach={coach} cards={data.scorecards} />
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {ran} ran · Formal {formal?.avg !== null && formal?.avg !== undefined ? formal.avg.toFixed(1) : '—'} ({formal?.count || 0})
                                · Self {self?.avg !== null && self?.avg !== undefined ? self.avg.toFixed(1) : '—'} ({self?.count || 0})
                                {gap !== null && (
                                  <> · Gap <span className={gap > 2 ? 'text-destructive' : gap < -2 ? 'text-success' : 'text-warning'}>{gap > 0 ? '+' : ''}{gap.toFixed(1)}</span></>
                                )}
                              </p>
                            </button>
                            {unscored > 0 && (
                              <button
                                type="button"
                                onClick={() => setUnscoredFor({
                                  coach,
                                  intros: data.unscoredIntros.filter(i => i.coach === coach),
                                })}
                                className="px-2.5 min-h-[36px] rounded-md border border-primary/40 bg-primary/5 text-primary text-[11px] font-semibold hover:bg-primary/10 cursor-pointer whitespace-nowrap"
                                title={`Score ${unscored} unscored ${unscored === 1 ? 'intro' : 'intros'}`}
                              >
                                {unscored} unscored →
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedCoach(expanded ? null : coach)}
                              className="p-2 min-h-[36px] min-w-[36px] rounded-md hover:bg-muted/50 cursor-pointer flex items-center justify-center"
                              title={expanded ? 'Collapse trend' : 'Expand trend'}
                              aria-label={expanded ? 'Collapse trend' : 'Expand trend'}
                            >
                              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </button>
                          </div>
                          {expanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-border bg-muted/20">
                              <p className="text-[10px] text-muted-foreground mb-1">{coach} vs studio (faded)</p>
                              <TrendChart
                                points={coachPoints}
                                studioOverlay={data.studioPoints}
                                onPointTap={(p) => setDrilldown({ label: `${coach} · ${p.bucket}`, cards: p.scorecards })}
                                primaryColor="hsl(20 90% 47%)"
                                secondaryColor="hsl(38 92% 60%)"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      {/* Drill-down modal (scorecard list) */}
      <Dialog open={!!drilldown} onOpenChange={o => !o && setDrilldown(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{drilldown?.label}</DialogTitle></DialogHeader>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            {(drilldown?.cards || []).length === 0 && <p className="text-xs text-muted-foreground">No scorecards in this bucket.</p>}
            {(drilldown?.cards || []).map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setOpenCardId(c.id); setDrilldown(null); }}
                className="w-full flex items-center justify-between p-2 rounded-md border hover:bg-muted text-left min-h-[44px]"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{c.evaluatee_name} <span className="text-muted-foreground">·</span> {c.practice_name || 'First-timer'}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(c.class_date), 'MMM d')} · {c.eval_type === 'self_eval' ? 'Self' : 'Formal'} · by {c.evaluator_name}</p>
                </div>
                <span className={`text-sm font-black tabular-nums ${c.level === 3 ? 'text-primary' : c.level === 2 ? 'text-success' : 'text-muted-foreground'}`}>{c.total_score}/30</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unscored drill-down (per coach or studio) */}
      {unscoredFor && (
        <UnscoredDrillDown
          open={!!unscoredFor}
          onOpenChange={(o) => { if (!o) setUnscoredFor(null); }}
          coach={unscoredFor.coach}
          intros={unscoredFor.intros}
        />
      )}

      <ComparisonView scorecardId={openCardId} open={!!openCardId} onOpenChange={(o) => { if (!o) setOpenCardId(null); }} />
    </Card>
  );
}

/* ───────────────────── helpers ───────────────────── */

function ToggleGroup({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 min-h-[32px] text-[11px] font-semibold transition-colors ${value === o.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CadenceDot({ status }: { status: 'met' | 'pending' | 'missed' }) {
  const cls = status === 'met' ? 'bg-success' : status === 'pending' ? 'bg-warning' : 'bg-destructive';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} aria-label={`Cadence: ${status}`} />;
}

function ClosingTiles({
  tiles,
  onTapClosed,
  onTapNotClosed,
  onTapCoverage,
}: {
  tiles: ReturnType<typeof useFvTrendData>['data']['closingTiles'];
  onTapClosed: () => void;
  onTapNotClosed: () => void;
  onTapCoverage: (bucket: 'formal' | 'selfOnly' | 'unscored') => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <button
        type="button"
        onClick={onTapClosed}
        disabled={tiles.closedCount === 0}
        className="text-left disabled:cursor-default cursor-pointer"
      >
        <Card className="p-3 border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors h-full">
          <p className="text-[10px] uppercase font-semibold text-primary tracking-wide">Avg score · closed</p>
          <p className="text-3xl font-black tabular-nums text-primary mt-1">{tiles.avgClosed !== null ? tiles.avgClosed.toFixed(1) : '—'}<span className="text-sm text-muted-foreground">/30</span></p>
          <p className="text-[10px] text-muted-foreground mt-1">{tiles.closedCount} {tiles.closedCount === 1 ? 'intro' : 'intros'} closed</p>
        </Card>
      </button>
      <button
        type="button"
        onClick={onTapNotClosed}
        disabled={tiles.notClosedCount === 0}
        className="text-left disabled:cursor-default cursor-pointer"
      >
        <Card className="p-3 border border-border bg-muted/30 hover:bg-muted/50 transition-colors h-full">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Avg score · didn't close</p>
          <p className="text-3xl font-black tabular-nums text-muted-foreground mt-1">{tiles.avgNotClosed !== null ? tiles.avgNotClosed.toFixed(1) : '—'}<span className="text-sm">/30</span></p>
          <p className="text-[10px] text-muted-foreground mt-1">{tiles.notClosedCount} {tiles.notClosedCount === 1 ? 'intro' : 'intros'} didn't close</p>
        </Card>
      </button>
      <Card className="p-3">
        <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide mb-1.5">Closing % by coverage</p>
        <CovRow label="Formal eval" v={tiles.coverage.formal} onTap={() => onTapCoverage('formal')} />
        <CovRow label="Self eval only" v={tiles.coverage.selfOnly} onTap={() => onTapCoverage('selfOnly')} />
        <CovRow label="Unscored" v={tiles.coverage.unscored} muted onTap={() => onTapCoverage('unscored')} />
      </Card>
    </div>
  );
}

function CovRow({ label, v, muted, onTap }: { label: string; v: { closed: number; total: number }; muted?: boolean; onTap?: () => void }) {
  const pct = v.total > 0 ? Math.round((v.closed / v.total) * 100) : null;
  const inner = (
    <div className="flex items-baseline justify-between text-[11px] py-0.5">
      <span className={muted ? 'text-muted-foreground' : 'font-medium'}>{label}</span>
      <span className="tabular-nums">{pct !== null ? `${pct}%` : '—'} <span className="text-muted-foreground">({v.closed}/{v.total})</span></span>
    </div>
  );
  if (!onTap || v.total === 0) return inner;
  return (
    <button type="button" onClick={onTap} className="w-full text-left rounded hover:bg-muted/40 px-1 -mx-1 cursor-pointer">
      {inner}
    </button>
  );
}

function TrendChart({
  points, studioOverlay, onPointTap, primaryColor, secondaryColor,
}: {
  points: TrendPoint[];
  studioOverlay?: TrendPoint[];
  onPointTap: (p: TrendPoint) => void;
  primaryColor: string;
  secondaryColor: string;
}) {
  if (points.length === 0) {
    return <p className="text-xs text-muted-foreground italic text-center py-6">No scorecards in this range yet.</p>;
  }
  // Merge studio overlay by bucket for the faded gray line
  const overlayByBucket = new Map(studioOverlay?.map(p => [p.bucket, ((p.formalAvg ?? p.selfAvg ?? 0))]) || []);
  const data = points.map(p => ({
    bucket: p.bucket,
    self: p.selfAvg !== null ? +p.selfAvg.toFixed(2) : null,
    formal: p.formalAvg !== null ? +p.formalAvg.toFixed(2) : null,
    studio: overlayByBucket.get(p.bucket) ?? null,
    raw: p,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} onClick={(e: any) => {
        const idx = e?.activeTooltipIndex;
        if (typeof idx === 'number' && data[idx]) onPointTap(data[idx].raw);
      }}>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" />
        <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 30]} tick={{ fontSize: 10 }} />
        <RTooltip
          contentStyle={{ fontSize: 11, borderRadius: 8 }}
          formatter={(v: any, n: any) => [v, n === 'formal' ? 'Formal avg' : n === 'self' ? 'Self avg' : 'Studio avg']}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {studioOverlay && (
          <Line type="monotone" dataKey="studio" name="Studio" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="3 3" dot={false} opacity={0.5} />
        )}
        <Line type="monotone" dataKey="self" name="Self" stroke={secondaryColor} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
        <Line type="monotone" dataKey="formal" name="Formal" stroke={primaryColor} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Card className="p-3 border-border/60">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-[220px] w-full" />
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Skeleton className="h-[110px]" />
        <Skeleton className="h-[110px]" />
        <Skeleton className="h-[110px]" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-40 mb-2" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    </div>
  );
}

function EmptyState({ onScoreFirst }: { onScoreFirst: () => void }) {
  return (
    <Card className="p-8 border-2 border-dashed border-primary/30 bg-primary/5 text-center space-y-3">
      <ClipboardCheck className="w-12 h-12 text-primary mx-auto" />
      <div>
        <p className="text-base font-bold">This is where elite gets measured.</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          First Visit Experience is the standard. The first scorecard starts the trend for every coach in this studio.
        </p>
      </div>
      <Button onClick={onScoreFirst} className="bg-[#E8540A] hover:bg-[#E8540A]/90 text-white min-h-[44px]">
        Score Your First Intro
      </Button>
    </Card>
  );
}

