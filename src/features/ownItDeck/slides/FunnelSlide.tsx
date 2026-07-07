import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import { DrillPanel, DrillStat } from '../DrillOverlay';
import type { FunnelStats } from '../useDeckData';

function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

export function FunnelSlide({
  kicker, title, slideNum, total, funnel, subtitle,
}: {
  kicker: string; title: string; slideNum: number; total: number;
  funnel: FunnelStats; subtitle?: string;
}) {
  const steps = [
    { label: 'Booked', value: funnel.booked, delta: null as string | null },
    { label: 'Showed', value: funnel.showed, delta: `${pct(funnel.showed, funnel.booked)} show rate` },
    { label: 'Sold',   value: funnel.sold,   delta: `${pct(funnel.sold, funnel.showed)} close rate` },
  ];

  const drill = (
    <DrillPanel
      title={`${title} — Booked rows`}
      subtitle={`${funnel.rows.length} booked intros · showed ${funnel.showed} · sold ${funnel.sold}`}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 20 }}>
        <thead>
          <tr style={{ background: '#FF6F0D18', textAlign: 'left' }}>
            <th style={dth}>Guest</th>
            <th style={dth}>Class date</th>
            <th style={dth}>Coach</th>
            <th style={dth}>Source</th>
            <th style={dth}>Status</th>
          </tr>
        </thead>
        <tbody>
          {funnel.rows.map(r => (
            <tr key={r.id} style={{ borderTop: '1px solid #D7D7D720' }}>
              <td style={dtd}>{r.member_name || '—'}</td>
              <td style={dtd}>{r.class_date || '—'}</td>
              <td style={dtd}>{r.coach_name || '—'}</td>
              <td style={dtd}>{r.lead_source || '—'}</td>
              <td style={{ ...dtd, fontWeight: 700 }}>{r.booking_status_canon}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DrillPanel>
  );

  return (
    <SlideFrame kicker={kicker} title={title} slideNum={slideNum} total={total} footer="Click stats or press D for booked rows">
      {subtitle && (
        <div style={{ ...S.bodySm, color: '#D7D7D7', opacity: 0.7, marginBottom: 24 }}>
          {subtitle}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, height: 620 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>
          {steps.map((s, i) => (
            <DrillStat key={s.label} drill={drill} style={{ flex: 1 }}>
              <div style={{
                height: '100%',
                border: `2px solid ${i === 0 ? S.orange : '#D7D7D720'}`,
                borderRadius: 20,
                padding: 32,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                background: i === 0 ? '#FF6F0D18' : 'transparent',
              }}>
                <div style={S.statLabel}>{s.label}</div>
                <div style={{
                  fontSize: 160, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em',
                  color: '#FDF7EA', textAlign: 'center',
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 22, color: '#D7D7D7', opacity: 0.75, minHeight: 32, textAlign: 'center' }}>
                  {s.delta ?? ''}
                </div>
              </div>
            </DrillStat>
          ))}
        </div>

        {/* Right: sources */}
        <div style={{
          border: '1px solid #D7D7D720', borderRadius: 20, padding: 24,
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{ ...S.statLabel, marginBottom: 14 }}>Top sources</div>
          {funnel.bySource.length === 0 ? (
            <div style={{ opacity: 0.5, fontSize: 22 }}>No bookings this month.</div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {funnel.bySource.slice(0, 8).map(row => {
                const width = funnel.leads > 0 ? Math.round((row.count / funnel.leads) * 100) : 0;
                return (
                  <div key={row.source}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, marginBottom: 4 }}>
                      <span style={{ color: '#FDF7EA', opacity: 0.9 }}>{row.source}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{row.count}</span>
                    </div>
                    <div style={{ height: 8, background: '#D7D7D712', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${width}%`, background: S.orange }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SlideFrame>
  );
}

const dth = { padding: '12px 16px', fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FDF7EA' };
const dtd = { padding: '12px 16px', color: '#FDF7EA' };
