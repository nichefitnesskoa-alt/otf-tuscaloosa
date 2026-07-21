/**
 * ShiftScoreboard — the constraint scoreboard.
 *
 * Three numbers, one card, top of MyDay. Speed to lead / Booking rate /
 * Show rate for THIS SA today, with the studio-this-week comparison
 * underneath each.
 *
 * All numbers come from src/lib/metrics/constraint.ts. Do not compute
 * anything here.
 */
import { useAuth } from '@/context/AuthContext';
import { useConstraintMetrics, todayRangeCentral, thisWeekRangeCentral } from '@/lib/metrics/constraint';
import { OTF, Theme, brandFont } from '@/lib/otfBrand';
import { Clock, Calendar, UserCheck } from 'lucide-react';

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${Math.round(v)}%`;
}
function fmtMin(v: number | null): string {
  if (v == null) return '—';
  if (v < 60) return `${Math.round(v)}m`;
  return `${(v / 60).toFixed(1)}h`;
}

function Tile({ icon, label, value, sub, tone }: {
  icon: React.ReactNode; label: string; value: string; sub: string; tone: 'green' | 'yellow' | 'red' | 'neutral';
}) {
  const accent =
    tone === 'green' ? '#22C55E' :
    tone === 'yellow' ? '#F59E0B' :
    tone === 'red' ? '#EF4444' : OTF.orange;
  return (
    <div
      className="flex-1 min-w-0 px-3 py-3"
      style={{ backgroundColor: Theme.card, border: `1px solid ${Theme.border}`, borderRadius: 6, ...brandFont }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color: OTF.bone, opacity: 0.65 }}>
        {icon}
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl leading-none tabular-nums" style={{ color: accent, fontWeight: 800 }}>
        {value}
      </div>
      <div className="text-[11px] mt-1" style={{ color: OTF.bone, opacity: 0.55 }}>{sub}</div>
    </div>
  );
}

export function ShiftScoreboard() {
  const { user } = useAuth();
  const today = todayRangeCentral();
  const week = thisWeekRangeCentral();
  const { data: mine } = useConstraintMetrics(today, user?.name);
  const { data: studio } = useConstraintMetrics(week, null);

  const speedTone: 'green' | 'yellow' | 'red' | 'neutral' =
    mine?.speedMedianMin == null ? 'neutral'
      : mine.speedMedianMin < 5 ? 'green'
      : mine.speedMedianMin <= 30 ? 'yellow' : 'red';
  const bookTone: 'green' | 'yellow' | 'red' | 'neutral' =
    mine?.booking.pct == null ? 'neutral'
      : mine.booking.pct >= 50 ? 'green'
      : mine.booking.pct >= 25 ? 'yellow' : 'red';
  const showTone: 'green' | 'yellow' | 'red' | 'neutral' =
    mine?.show.pct == null ? 'neutral'
      : mine.show.pct >= 75 ? 'green'
      : mine.show.pct >= 60 ? 'yellow' : 'red';

  return (
    <div className="p-3" style={{ backgroundColor: OTF.dark, border: `1px solid ${Theme.border}`, borderRadius: 8, ...brandFont }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: OTF.bone, opacity: 0.55 }}>
          Your shift · The game
        </span>
        <span className="text-[10px]" style={{ color: OTF.bone, opacity: 0.4 }}>
          today
        </span>
      </div>
      <div className="flex gap-2">
        <Tile
          icon={<Clock className="w-3 h-3" />}
          label="Speed to lead"
          value={fmtMin(mine?.speedMedianMin ?? null)}
          sub={`Studio wk: ${fmtMin(studio?.speedMedianMin ?? null)}`}
          tone={speedTone}
        />
        <Tile
          icon={<Calendar className="w-3 h-3" />}
          label="Booking rate"
          value={fmtPct(mine?.booking.pct ?? null)}
          sub={`Studio wk: ${fmtPct(studio?.booking.pct ?? null)}`}
          tone={bookTone}
        />
        <Tile
          icon={<UserCheck className="w-3 h-3" />}
          label="Show rate"
          value={fmtPct(mine?.show.pct ?? null)}
          sub={`Studio wk: ${fmtPct(studio?.show.pct ?? null)}`}
          tone={showTone}
        />
      </div>
    </div>
  );
}
