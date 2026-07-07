import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import type { DeckData } from '../useDeckData';

export function Slide04Soml({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const { config, rows, totals } = data.soml;
  if (!config) {
    return (
      <SlideFrame kicker="Summer of More Life" title="SOML Stats" slideNum={slideNum} total={total}>
        <div style={{ ...S.body, opacity: 0.7 }}>SOML window is not configured.</div>
      </SlideFrame>
    );
  }
  const sorted = [...rows].sort((a, b) => (b.referrals + b.upgrades + b.sales) - (a.referrals + a.upgrades + a.sales));

  return (
    <SlideFrame
      kicker="Summer of More Life"
      title="SOML Stats"
      slideNum={slideNum}
      total={total}
      footer={`${config.start_date} → ${config.end_date}`}
    >
      <div style={{ display: 'flex', gap: 32, marginBottom: 40 }}>
        <TotalCard label="Referrals" value={totals.referrals} goal={config.referrals_goal} />
        <TotalCard label="Upgrades" value={totals.upgrades} goal={config.upgrades_goal} />
        <TotalCard label="Sales" value={totals.sales} goal={config.sales_goal} />
      </div>
      <div style={{ overflow: 'hidden', border: '1px solid #D7D7D720', borderRadius: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 24 }}>
          <thead>
            <tr style={{ background: '#FF6F0D18', textAlign: 'left' }}>
              <th style={cellHeader}>SA</th>
              <th style={cellHeaderNum}>Referrals</th>
              <th style={cellHeaderNum}>Upgrades</th>
              <th style={cellHeaderNum}>Sales</th>
              <th style={cellHeaderNum}>Pending</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 10).map(r => (
              <tr key={r.sa} style={{ borderTop: '1px solid #D7D7D720' }}>
                <td style={cell}>{r.sa}</td>
                <td style={cellNum}>{r.referrals}</td>
                <td style={cellNum}>{r.upgrades}</td>
                <td style={cellNum}>{r.sales}</td>
                <td style={{ ...cellNum, opacity: 0.6 }}>{r.pending}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SlideFrame>
  );
}

function TotalCard({ label, value, goal }: { label: string; value: number; goal: number }) {
  const onPace = goal > 0 ? value / goal : 0;
  return (
    <div style={{
      flex: 1, border: '2px solid #D7D7D720', borderRadius: 20, padding: 32,
      background: onPace >= 1 ? '#34D39918' : '#FF6F0D08',
    }}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em' }}>
        {value}<span style={{ fontSize: 48, opacity: 0.5 }}> / {goal}</span>
      </div>
    </div>
  );
}

const cellHeader = { padding: '18px 24px', fontSize: 20, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FDF7EA' };
const cellHeaderNum = { ...cellHeader, textAlign: 'right' as const };
const cell = { padding: '18px 24px', color: '#FDF7EA' };
const cellNum = { padding: '18px 24px', color: '#FDF7EA', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, fontWeight: 700 };
