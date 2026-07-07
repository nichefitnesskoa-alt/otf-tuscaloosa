import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import type { DeckData } from '../useDeckData';

export function Slide06CoachClose({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const { overallPct, goalPct } = data.coachClose;
  const delta = overallPct != null && goalPct != null ? overallPct - goalPct : null;
  const onPace = delta != null && delta >= 0;
  const color = onPace ? S.success : overallPct != null ? S.danger : '#FDF7EA';

  return (
    <SlideFrame kicker="WIG — Coaches" title="Coach Close Rate" slideNum={slideNum} total={total}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 96 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={S.statLabel}>Overall (First intros this month)</div>
          <div style={{ ...S.bigStat, color, fontSize: 260 }}>
            {overallPct != null ? `${overallPct}%` : '—'}
          </div>
        </div>
        <div style={{ flex: 1, borderLeft: '2px solid #FF6F0D40', paddingLeft: 96 }}>
          <div style={S.statLabel}>Monthly Goal</div>
          <div style={{ fontSize: 160, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em' }}>
            {goalPct != null ? `${goalPct}%` : '—'}
          </div>
          {delta != null && (
            <div style={{
              marginTop: 40, fontSize: 44, fontWeight: 700,
              color: onPace ? S.success : S.danger,
            }}>
              {onPace ? 'Above goal' : 'Below goal'} · {delta >= 0 ? '+' : ''}{delta} pts
            </div>
          )}
        </div>
      </div>
    </SlideFrame>
  );
}
