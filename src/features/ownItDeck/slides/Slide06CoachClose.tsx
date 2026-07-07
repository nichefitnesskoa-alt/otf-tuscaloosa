import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import { DrillPanel, DrillStat } from '../DrillOverlay';
import type { DeckData } from '../useDeckData';

export function Slide06CoachClose({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const { overallPct, goalPct, overallRuns, overallSales, rows } = data.coachClose;
  const delta = overallPct != null && goalPct != null ? overallPct - goalPct : null;
  const onPace = delta != null && delta >= 0;
  const color = onPace ? S.success : overallPct != null ? S.danger : '#FDF7EA';

  const drill = (
    <DrillPanel title="Coach Close % — per coach" subtitle="First intros only, this month">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 22 }}>
        <thead>
          <tr style={{ background: '#FF6F0D18', textAlign: 'left' }}>
            <th style={dth}>Coach</th>
            <th style={dth}>Ran</th>
            <th style={dth}>Sold</th>
            <th style={dth}>Close %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name} style={{ borderTop: '1px solid #D7D7D720' }}>
              <td style={dtd}>{r.name}</td>
              <td style={dtd}>{r.runs}</td>
              <td style={dtd}>{r.sales}</td>
              <td style={{ ...dtd, fontWeight: 800 }}>{r.closePct != null ? `${r.closePct}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DrillPanel>
  );

  return (
    <SlideFrame kicker="WIG — Coaches" title="Coach Close Rate" slideNum={slideNum} total={total} footer="Click % or press D for per-coach">
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 80 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={S.statLabel}>Overall (First intros this month)</div>
          <DrillStat drill={drill}>
            <div style={{ ...S.bigStat, color, fontSize: 240 }}>
              {overallPct != null ? `${overallPct}%` : '—'}
            </div>
          </DrillStat>
          <div style={{ marginTop: 12, fontSize: 26, opacity: 0.7 }}>
            {overallSales} sold of {overallRuns} ran
          </div>
        </div>
        <div style={{ flex: 1, borderLeft: '2px solid #FF6F0D40', paddingLeft: 80 }}>
          <div style={S.statLabel}>Monthly Goal</div>
          <div style={{ fontSize: 140, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em' }}>
            {goalPct != null ? `${goalPct}%` : '—'}
          </div>
          {delta != null && (
            <div style={{
              marginTop: 32, fontSize: 40, fontWeight: 700,
              color: onPace ? S.success : S.danger,
            }}>
              {onPace ? 'Above goal' : 'Below goal'} · {delta >= 0 ? '+' : ''}{delta} pts
            </div>
          )}
          {overallPct == null && (
            <div style={{ marginTop: 32, fontSize: 24, opacity: 0.6 }}>
              No first-intro runs recorded yet this month.
            </div>
          )}
        </div>
      </div>
    </SlideFrame>
  );
}

const dth = { padding: '12px 16px', fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FDF7EA' };
const dtd = { padding: '12px 16px', color: '#FDF7EA' };
