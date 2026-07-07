import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import type { DeckData } from '../useDeckData';

export function Slide01NetGain({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const { value, goal, delta } = data.netGain;
  const positive = value > 0;
  const onPace = delta != null && delta >= 0;
  const bigColor = positive ? S.success : value < 0 ? S.danger : '#FDF7EA';

  return (
    <SlideFrame kicker="Beat 1 — Scoreboard" title="Net Gain vs Goal" slideNum={slideNum} total={total}>
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 96 }}>
        <div style={{ flex: 1 }}>
          <div style={S.statLabel}>Members this month</div>
          <div style={{ ...S.bigStat, color: bigColor }}>
            {value > 0 ? '+' : ''}{value}
          </div>
        </div>
        <div style={{ flex: 1, borderLeft: '2px solid #FF6F0D40', paddingLeft: 96 }}>
          <div style={S.statLabel}>Monthly Goal</div>
          <div style={{ fontSize: 160, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em' }}>
            {goal != null ? `+${goal}` : '—'}
          </div>
          {delta != null && (
            <div style={{
              marginTop: 40, fontSize: 44, fontWeight: 700,
              color: onPace ? S.success : S.danger,
            }}>
              {onPace ? 'On pace' : 'Behind'} · {delta >= 0 ? '+' : ''}{delta}
            </div>
          )}
          {goal == null && (
            <div style={{ marginTop: 40, fontSize: 28, color: '#D7D7D7', opacity: 0.7 }}>
              Set the monthly goal in the Net Gain scoreboard.
            </div>
          )}
        </div>
      </div>
    </SlideFrame>
  );
}
