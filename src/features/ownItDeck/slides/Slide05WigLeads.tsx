import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import { DrillPanel, DrillStat } from '../DrillOverlay';
import type { DeckData } from '../useDeckData';

export function Slide05WigLeads({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const targetLeads = data.targets.studioLeads;
  const totalLeads = data.studioLeadsTotal;
  const pace = data.studioLeadsPace;
  const pct = targetLeads && totalLeads != null ? Math.round((totalLeads / targetLeads) * 100) : null;
  const onPace = pace != null && totalLeads != null && totalLeads >= pace;
  const heroColor = totalLeads == null ? '#FDF7EA' : onPace ? S.success : S.warning;

  const drill = (
    <DrillPanel
      title="Studio Leads — All lead rows this month"
      subtitle={`${data.leadRows.length} lead rows in the leads table this month`}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 20 }}>
        <thead>
          <tr style={{ background: '#FF6F0D18', textAlign: 'left' }}>
            <th style={dth}>Name</th>
            <th style={dth}>Source</th>
            <th style={dth}>Created</th>
          </tr>
        </thead>
        <tbody>
          {data.leadRows
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #D7D7D720' }}>
                <td style={dtd}>{r.name || '—'}</td>
                <td style={dtd}>{r.source || '—'}</td>
                <td style={{ ...dtd, opacity: 0.7 }}>{r.created_at.slice(0, 10)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </DrillPanel>
  );

  return (
    <SlideFrame
      kicker="WIG — Leads"
      title="Studio Leads vs Target"
      slideNum={slideNum}
      total={total}
      footer="Click leads number or press D for all lead rows"
    >
      <div style={{ display: 'flex', gap: 80, alignItems: 'center', height: '100%' }}>
        <div style={{ flex: 1 }}>
          <div style={S.statLabel}>Leads MTD (studio-wide)</div>
          <DrillStat drill={drill}>
            <div style={{ ...S.bigStat, color: heroColor }}>{totalLeads ?? '—'}</div>
          </DrillStat>
          <div style={{ marginTop: 20, fontSize: 26, opacity: 0.8 }}>
            {targetLeads != null && (
              <>Target: <b>{targetLeads}</b>{pct != null ? ` · ${pct}% of goal` : ''}</>
            )}
          </div>
          {pace != null && totalLeads != null && (
            <div style={{ marginTop: 10, fontSize: 22, color: onPace ? S.success : S.warning, fontWeight: 700 }}>
              Should be at {pace} today · {onPace ? `+${Math.round(totalLeads - pace)} ahead` : `${Math.round(pace - totalLeads)} behind`}
            </div>
          )}
          <div style={{ marginTop: 24, fontSize: 18, opacity: 0.5 }}>
            Source: monthly_lead_totals (entered in WIG). Booked funnel to the right counts intros_booked only.
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ ...S.statLabel }}>Booked intros this month</div>
          <SplitRow label="Self-Generated (SGL)" value={data.sglFunnel.leads} accent={S.orange} />
          <SplitRow label="Non-SGL (Web)" value={data.nonSglFunnel.leads} accent="#1DD0FD" />
          <div style={{ borderTop: '1px solid #D7D7D720', paddingTop: 20 }}>
            <SplitRow label="Booked → Showed" value={data.sglFunnel.showed + data.nonSglFunnel.showed} accent="#FDF7EA" />
            <div style={{ height: 12 }} />
            <SplitRow label="Sold" value={data.sglFunnel.sold + data.nonSglFunnel.sold} accent={S.success} />
          </div>

          <div style={{ marginTop: 12, borderTop: '1px solid #D7D7D720', paddingTop: 16 }}>
            <div style={{ ...S.statLabel, fontSize: 16, marginBottom: 8 }}>Top lead sources</div>
            {data.topLeadSources.length === 0 ? (
              <div style={{ opacity: 0.5, fontSize: 20 }}>No leads yet this month.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.topLeadSources.slice(0, 5).map(r => (
                  <div key={r.source} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20 }}>
                    <span style={{ opacity: 0.9 }}>{r.source}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

function SplitRow({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 24, color: '#D7D7D7', opacity: 0.85 }}>{label}</span>
      <span style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.04em', color: accent }}>{value}</span>
    </div>
  );
}

const dth = { padding: '12px 16px', fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#FDF7EA' };
const dtd = { padding: '12px 16px', color: '#FDF7EA' };
