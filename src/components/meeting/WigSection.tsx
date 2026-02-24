import { MeetingSection } from './MeetingSection';
import { Target, Timer, ClipboardCheck, BookOpen, MessageCircle, Users } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface PerSAMetric {
  saName: string;
  speedToLead: number | null;
  qCompletionPct: number | null;
  prepRatePct: number | null;
  followUpTouches: number;
  dmsSent: number;
  leadsReachedOut: number;
}

interface Props {
  closeRate: number;
  wigTarget: string;
  wigCommitments: string;
  previousCommitments: string | null;
  onTargetChange: (v: string) => void;
  onCommitmentsChange: (v: string) => void;
  isAdmin: boolean;
  isPresentMode: boolean;
  perSAMetrics?: PerSAMetric[];
}

function formatSpeed(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function speedColor(minutes: number | null): string {
  if (minutes === null) return 'text-muted-foreground';
  if (minutes <= 15) return 'text-success';
  if (minutes <= 60) return 'text-warning';
  return 'text-destructive';
}

function pctColor(pct: number | null): string {
  if (pct === null) return 'text-muted-foreground';
  if (pct >= 70) return 'text-success';
  if (pct >= 50) return 'text-warning';
  return 'text-destructive';
}

export function WigSection({ closeRate, wigTarget, wigCommitments, previousCommitments, onTargetChange, onCommitmentsChange, isAdmin, isPresentMode, perSAMetrics }: Props) {
  return (
    <MeetingSection title="WIG Session — Lead Measures" icon={<Target className={isPresentMode ? 'w-10 h-10' : 'w-5 h-5'} />} sectionId="wig" isPresentMode={isPresentMode}>
      {isPresentMode ? (
        <div className="text-white space-y-8">
          <p className="text-lg text-white/50">Led by Alex</p>

          <div className="text-center">
            <p className="text-5xl font-black">{closeRate.toFixed(0)}%</p>
            <p className="text-xl text-white/60 mt-2">Current Close Rate</p>
            {wigTarget && <p className="text-lg text-yellow-400 mt-1">Target: {wigTarget}</p>}
          </div>

          {/* Per-SA Lead Measures Table */}
          {perSAMetrics && perSAMetrics.length > 0 && (
            <div className="bg-white/10 rounded-xl p-4 overflow-x-auto">
              <p className="text-lg font-semibold text-primary mb-3">Lead Measures by SA</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-2 pr-3 text-white/60">SA</th>
                    <th className="text-center py-2 px-2 text-white/60">Speed</th>
                    <th className="text-center py-2 px-2 text-white/60">Q %</th>
                    <th className="text-center py-2 px-2 text-white/60">Prep %</th>
                    <th className="text-center py-2 px-2 text-white/60">FU</th>
                    <th className="text-center py-2 px-2 text-white/60">DMs</th>
                    <th className="text-center py-2 px-2 text-white/60">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {perSAMetrics.map(sa => (
                    <tr key={sa.saName} className="border-b border-white/10">
                      <td className="py-2 pr-3 font-medium">{sa.saName}</td>
                      <td className={`text-center py-2 px-2 font-semibold ${speedColor(sa.speedToLead)}`}>{formatSpeed(sa.speedToLead)}</td>
                      <td className={`text-center py-2 px-2 font-semibold ${pctColor(sa.qCompletionPct)}`}>{sa.qCompletionPct !== null ? `${sa.qCompletionPct}%` : '—'}</td>
                      <td className={`text-center py-2 px-2 font-semibold ${pctColor(sa.prepRatePct)}`}>{sa.prepRatePct !== null ? `${sa.prepRatePct}%` : '—'}</td>
                      <td className="text-center py-2 px-2 font-semibold">{sa.followUpTouches}</td>
                      <td className="text-center py-2 px-2 font-semibold">{sa.dmsSent}</td>
                      <td className="text-center py-2 px-2 font-semibold">{sa.leadsReachedOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previousCommitments && (
            <div className="bg-white/10 rounded-xl p-6">
              <p className="text-lg font-semibold text-yellow-400 mb-3">Last Week's Commitments</p>
              <p className="text-lg text-white/80 whitespace-pre-wrap">{previousCommitments}</p>
            </div>
          )}

          {wigCommitments && (
            <div className="bg-white/10 rounded-xl p-6">
              <p className="text-lg font-semibold text-green-400 mb-3">This Week's Commitments</p>
              <p className="text-lg text-white/80 whitespace-pre-wrap">{wigCommitments}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Led by Alex</p>

          <div className="flex items-center gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{closeRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Close Rate</p>
            </div>
            {isAdmin ? (
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">WIG Target</label>
                <Input value={wigTarget} onChange={e => onTargetChange(e.target.value)} placeholder="e.g. 45% close rate" />
              </div>
            ) : wigTarget ? (
              <p className="text-sm">Target: {wigTarget}</p>
            ) : null}
          </div>

          {/* Per-SA Lead Measures Table */}
          {perSAMetrics && perSAMetrics.length > 0 && (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">SA</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                      <Timer className="w-3 h-3 mx-auto" />
                      <span className="block text-[9px]">Speed</span>
                    </th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                      <ClipboardCheck className="w-3 h-3 mx-auto" />
                      <span className="block text-[9px]">Q %</span>
                    </th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                      <BookOpen className="w-3 h-3 mx-auto" />
                      <span className="block text-[9px]">Prep</span>
                    </th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                      <MessageCircle className="w-3 h-3 mx-auto" />
                      <span className="block text-[9px]">FU</span>
                    </th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground text-[9px]">DMs</th>
                    <th className="text-center py-2 px-1 font-medium text-muted-foreground">
                      <Users className="w-3 h-3 mx-auto" />
                      <span className="block text-[9px]">Leads</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {perSAMetrics.map(sa => (
                    <tr key={sa.saName} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 px-2 font-medium truncate max-w-[80px]">{sa.saName}</td>
                      <td className={`text-center py-1.5 px-1 font-semibold ${speedColor(sa.speedToLead)}`}>{formatSpeed(sa.speedToLead)}</td>
                      <td className={`text-center py-1.5 px-1 font-semibold ${pctColor(sa.qCompletionPct)}`}>{sa.qCompletionPct !== null ? `${sa.qCompletionPct}%` : '—'}</td>
                      <td className={`text-center py-1.5 px-1 font-semibold ${pctColor(sa.prepRatePct)}`}>{sa.prepRatePct !== null ? `${sa.prepRatePct}%` : '—'}</td>
                      <td className="text-center py-1.5 px-1 font-semibold">{sa.followUpTouches}</td>
                      <td className="text-center py-1.5 px-1 font-semibold">{sa.dmsSent}</td>
                      <td className="text-center py-1.5 px-1 font-semibold">{sa.leadsReachedOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previousCommitments && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Last Week's Commitments</p>
              <p className="text-yellow-700 dark:text-yellow-300 whitespace-pre-wrap">{previousCommitments}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground block mb-1">This Week's Commitments</label>
            {isAdmin ? (
              <Textarea
                value={wigCommitments}
                onChange={e => onCommitmentsChange(e.target.value)}
                placeholder="Type commitments during/after the meeting..."
                rows={3}
              />
            ) : wigCommitments ? (
              <p className="text-sm whitespace-pre-wrap">{wigCommitments}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No commitments yet.</p>
            )}
          </div>
        </div>
      )}
    </MeetingSection>
  );
}
