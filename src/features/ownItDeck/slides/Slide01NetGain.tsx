import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import { DrillPanel, DrillStat } from '../DrillOverlay';
import type { DeckData } from '../useDeckData';

export function Slide01NetGain({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const { value, goal, delta, pendingChurns, scheduledTerminationsLeft, salesNeededToHitGoal, pace } = data.netGain;
  const positive = value > 0;
  const onPace = delta != null && delta >= 0;
  const bigColor = positive ? S.success : value < 0 ? S.danger : '#FDF7EA';

  const drill = (
    <DrillPanel
      title="Net Gain — Scheduled terminations"
      subtitle={`${scheduledTerminationsLeft} pending churn${scheduledTerminationsLeft === 1 ? '' : 's'} left this month`}
    >
      {pendingChurns.length === 0 ? (
        <div style={{ opacity: 0.6 }}>No pending terminations on the books.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 22 }}>
          <thead>
            <tr style={{ background: '#FF6F0D18', textAlign: 'left' }}>
              <th style={dth}>Member</th>
              <th style={dth}>Date</th>
              <th style={dth}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {pendingChurns.map(c => (
              <tr key={c.id} style={{ borderTop: '1px solid #D7D7D720' }}>
                <td style={dtd}>{c.member_name}</td>
                <td style={dtd}>{c.churn_date}</td>
                <td style={{ ...dtd, opacity: 0.7 }}>{c.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DrillPanel>
  );

  return (
    <SlideFrame
      kicker="Beat 1 — Scoreboard"
      title="Net Gain vs Goal"
      slideNum={slideNum}
      total={total}
      footer="Click any stat or press D for pending churns"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 64, height: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={S.statLabel}>Members this month</div>
            <div style={{ ...S.bigStat, color: bigColor }}>{value > 0 ? '+' : ''}{value}</div>
          </div>
          <DetailGrid>
            <Detail label="Monthly goal" value={goal != null ? `+${goal}` : '—'} />
            <Detail label="vs goal" value={delta != null ? `${delta >= 0 ? '+' : ''}${delta}` : '—'}
              tone={onPace ? 'good' : delta != null ? 'bad' : 'neutral'} />
            <Detail label="Should be at (today)" value={pace != null ? String(pace) : '—'} />
            <Detail label="Scheduled churns left" value={scheduledTerminationsLeft} tone={scheduledTerminationsLeft > 0 ? 'warn' : 'neutral'} />
          </DetailGrid>
        </div>

        <div style={{ borderLeft: '2px solid #FF6F0D40', paddingLeft: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={S.statLabel}>Sales needed by EOM to hit goal</div>
            <div style={{
              fontSize: 180, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em',
              color: salesNeededToHitGoal != null && salesNeededToHitGoal > 0 ? S.warning : S.success,
            }}>
              {salesNeededToHitGoal != null ? `+${salesNeededToHitGoal}` : '—'}
            </div>
            {goal != null && (
              <div style={{ marginTop: 20, fontSize: 26, color: '#FDF7EA', opacity: 0.75 }}>
                Goal +{goal} · {scheduledTerminationsLeft} churn{scheduledTerminationsLeft === 1 ? '' : 's'} pending · current {value > 0 ? '+' : ''}{value}
              </div>
            )}
          </div>

          <DrillStat drill={drill}>
            <div style={{
              border: '1px solid #FF6F0D60', borderRadius: 14, padding: '18px 22px',
              background: '#FF6F0D10',
            }}>
              <div style={{ ...S.statLabel, fontSize: 18, color: '#FF6F0D' }}>Next scheduled churn</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: '#FDF7EA' }}>
                {pendingChurns[0]
                  ? `${pendingChurns[0].member_name} · ${pendingChurns[0].churn_date}`
                  : 'None on the books'}
              </div>
              <div style={{ fontSize: 18, opacity: 0.65, marginTop: 6 }}>Click for full list</div>
            </div>
          </DrillStat>
        </div>
      </div>
    </SlideFrame>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 32 }}>{children}</div>;
}
function Detail({ label, value, tone = 'neutral' }: {
  label: string; value: React.ReactNode; tone?: 'good' | 'bad' | 'warn' | 'neutral';
}) {
  const color = tone === 'good' ? S.success : tone === 'bad' ? S.danger : tone === 'warn' ? S.warning : '#FDF7EA';
  return (
    <div style={{ border: '1px solid #D7D7D720', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ ...S.statLabel, fontSize: 15, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

const dth = { padding: '14px 18px', fontSize: 18, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FDF7EA' };
const dtd = { padding: '14px 18px', color: '#FDF7EA' };
