import { SlideFrame } from '../SlideFrame';
import type { DeckData } from '../useDeckData';

export function Slide07CoachStats({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const rows = data.coachClose.rows;
  const goal = data.coachClose.goalPct;
  return (
    <SlideFrame kicker="WIG — Coaches" title="Individual Coach Stats" slideNum={slideNum} total={total}>
      {rows.length === 0 ? (
        <div style={{ fontSize: 32, opacity: 0.7 }}>No coach runs yet this month.</div>
      ) : (
        <div style={{ overflow: 'hidden', border: '1px solid #D7D7D720', borderRadius: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 24 }}>
            <thead>
              <tr style={{ background: '#FF6F0D18', textAlign: 'left' }}>
                <th style={th}>Coach</th>
                <th style={thNum}>Ran (1st)</th>
                <th style={thNum}>2nds ran</th>
                <th style={thNum}>Sold</th>
                <th style={thNum}>Close %</th>
                <th style={thNum}>vs Goal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const delta = r.closePct != null && goal != null ? r.closePct - goal : null;
                const onPace = delta != null && delta >= 0;
                return (
                  <tr key={r.name} style={{ borderTop: '1px solid #D7D7D720' }}>
                    <td style={td}>{r.name}</td>
                    <td style={tdNum}>{r.firstRuns}</td>
                    <td style={{ ...tdNum, opacity: 0.7 }}>{r.secondRuns}</td>
                    <td style={tdNum}>{r.sales}</td>
                    <td style={{ ...tdNum, color: onPace ? '#34D399' : '#EF4444', fontWeight: 900 }}>
                      {r.closePct != null ? `${r.closePct}%` : '—'}
                    </td>
                    <td style={{ ...tdNum, color: onPace ? '#34D399' : '#EF4444' }}>
                      {delta != null ? `${delta >= 0 ? '+' : ''}${delta}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SlideFrame>
  );
}

const th = { padding: '18px 22px', fontSize: 18, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FDF7EA' };
const thNum = { ...th, textAlign: 'right' as const };
const td = { padding: '18px 22px', color: '#FDF7EA' };
const tdNum = { padding: '18px 22px', color: '#FDF7EA', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, fontWeight: 700 };
