import { MeetingMetrics } from '@/hooks/useMeetingAgenda';
import { MeetingSection } from './MeetingSection';
import { BarChart3, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CLOSE_RATE_THRESHOLDS } from '@/lib/studio-metrics';

interface Props {
  metrics: MeetingMetrics;
  dateLabel: string;
  isPresentMode: boolean;
}

function Trend({ current, previous, suffix = '', invert = false }: { current: number; previous: number; suffix?: string; invert?: boolean }) {
  const diff = current - previous;
  const isUp = invert ? diff < 0 : diff > 0;
  const isDown = invert ? diff > 0 : diff < 0;
  if (Math.abs(diff) < 0.5) return <Minus className="w-4 h-4 text-muted-foreground inline" />;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-sm font-medium', isUp ? 'text-green-400' : 'text-red-400')}>
      {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      {Math.abs(diff).toFixed(0)}{suffix}
    </span>
  );
}

export function ScoreboardSection({ metrics, dateLabel, isPresentMode }: Props) {
  const m = metrics;

  if (isPresentMode) {
    return (
      <MeetingSection title="This Week's Numbers" icon={<BarChart3 className="w-10 h-10" />} sectionId="scoreboard" isPresentMode>
        <p className="text-lg text-white/50 mb-8 text-center">{dateLabel}</p>

        {/* Hero Row */}
        <div className="grid grid-cols-3 gap-8 mb-10">
          <div className="text-center">
            <p className="text-6xl font-black text-white">{m.amc}</p>
            <p className="text-lg text-white/60 mt-1">AMC</p>
            <Trend current={m.amc} previous={m.amc - m.amcChange} />
          </div>
          <div className="text-center">
            <p className="text-6xl font-black text-green-400">{m.sales}</p>
            <p className="text-lg text-white/60 mt-1">Sales</p>
            <Trend current={m.sales} previous={m.salesPrev} />
          </div>
          <div className="text-center">
            <p className={cn("text-6xl font-black", m.closeRate >= CLOSE_RATE_THRESHOLDS.green ? 'text-green-400' : m.closeRate >= CLOSE_RATE_THRESHOLDS.amber ? 'text-yellow-400' : 'text-red-400')}>{m.closeRate.toFixed(0)}%</p>
            <p className="text-lg text-white/60 mt-1">Close Rate</p>
            <Trend current={m.closeRate} previous={m.closeRatePrev} suffix="%" />
          </div>
        </div>

        {/* Pipeline Row */}
        <div className="bg-white/10 rounded-xl p-6 mb-6 text-center">
          <p className="text-2xl text-white">
            <span className="font-bold">{m.booked}</span> Booked → <span className="font-bold">{m.showed}</span> Showed
            <span className="text-white/50"> ({m.showRate.toFixed(0)}%)</span> → <span className="font-bold text-green-400">{m.introSales}</span> Sold
          </p>
          <p className="text-lg text-red-400 mt-2">{m.noShows} No-Shows ({m.noShowRate.toFixed(0)}%)</p>
          {m.sales - m.introSales > 0 && (
            <p className="text-sm text-white/60 mt-1">Total Sales: {m.sales} (includes {m.sales - m.introSales} outside-intro)</p>
          )}
        </div>

        {/* Lead Measures */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Q Completion', value: `${m.qCompletion.toFixed(0)}%`, trend: <Trend current={m.qCompletion} previous={m.qCompletionPrev} suffix="%" /> },
            { label: 'Follow-Up', value: `${m.followUpCompleted}/${m.followUpTotal}`, trend: null },
            { label: 'Speed-to-Lead', value: m.speedToLead > 0 ? `${m.speedToLead}m` : 'N/A', trend: null },
            { label: 'Confirmations', value: `${m.confirmationsSent}/${m.confirmationsTotal}`, trend: null },
          ].map((item, i) => (
            <div key={i} className="bg-white/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-white">{item.value}</p>
              <p className="text-sm text-white/50 mt-1">{item.label}</p>
              {item.trend}
            </div>
          ))}
        </div>

        {/* Leads */}
        <div className="bg-white/10 rounded-xl p-4 mb-6">
          <p className="text-xl text-white mb-2">{m.newLeads} New Leads This Week</p>
          <div className="flex flex-wrap gap-3 text-sm text-white/70">
            {Object.entries(m.leadsBySource).map(([src, count]) => (
              <span key={src}>{count} {src}</span>
            ))}
          </div>
          <p className="text-sm text-white/50 mt-2">{m.leadsContacted} contacted · {m.leadsUncontacted} uncontacted</p>
        </div>

        {/* Biggest Opportunity */}
        {m.biggestOpportunity && (
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
              <p className="text-xl font-bold text-yellow-400">Biggest Opportunity</p>
            </div>
            <p className="text-lg text-white">{m.biggestOpportunity}</p>
          </div>
        )}
      </MeetingSection>
    );
  }

  // Prep mode
  return (
    <MeetingSection title="This Week's Numbers" icon={<BarChart3 className="w-5 h-5" />} sectionId="scoreboard" isPresentMode={false}>
      <p className="text-xs text-muted-foreground mb-3">{dateLabel}</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-muted rounded-lg">
          <p className="text-2xl font-bold">{m.amc}</p>
          <p className="text-xs text-muted-foreground">AMC</p>
          <Trend current={m.amc} previous={m.amc - m.amcChange} />
        </div>
        <div className="text-center p-3 bg-muted rounded-lg">
          <p className="text-2xl font-bold text-green-600">{m.sales}</p>
          <p className="text-xs text-muted-foreground">Sales</p>
          <Trend current={m.sales} previous={m.salesPrev} />
        </div>
        <div className="text-center p-3 bg-muted rounded-lg">
          <p className={cn("text-2xl font-bold", m.closeRate >= CLOSE_RATE_THRESHOLDS.green ? 'text-green-600' : m.closeRate >= CLOSE_RATE_THRESHOLDS.amber ? 'text-yellow-600' : 'text-red-600')}>{m.closeRate.toFixed(0)}%</p>
          <p className="text-xs text-muted-foreground">Close Rate</p>
          <Trend current={m.closeRate} previous={m.closeRatePrev} suffix="%" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mb-3">
        {m.booked} Booked → {m.showed} Showed ({m.showRate.toFixed(0)}%) → {m.introSales} Sold · {m.noShows} No-Shows
        {m.sales - m.introSales > 0 && ` · Total Sales: ${m.sales} (${m.sales - m.introSales} outside-intro)`}
      </p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="p-2 bg-muted rounded">Q Completion: {m.qCompletion.toFixed(0)}%</div>
        <div className="p-2 bg-muted rounded">Follow-Up: {m.followUpCompleted}/{m.followUpTotal}</div>
        <div className="p-2 bg-muted rounded">Speed-to-Lead: {m.speedToLead > 0 ? `${m.speedToLead}m` : 'N/A'}</div>
        <div className="p-2 bg-muted rounded">Leads: {m.newLeads} new ({m.leadsContacted} contacted)</div>
      </div>
      {m.biggestOpportunity && (
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm">
          <p className="font-medium text-yellow-800 dark:text-yellow-200">💡 Biggest Opportunity</p>
          <p className="text-yellow-700 dark:text-yellow-300 mt-1">{m.biggestOpportunity}</p>
        </div>
      )}
    </MeetingSection>
  );
}
