import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import type { DeckData } from '../useDeckData';

export function Slide05WigLeads({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const targetLeads = data.targets.studioLeads;
  const totalLeads = data.sglFunnel.leads + data.nonSglFunnel.leads;
  const pct = targetLeads ? Math.round((totalLeads / targetLeads) * 100) : null;
  const onPace = pct != null && pct >= 100;

  return (
    <SlideFrame kicker="WIG — Leads" title="Studio Leads vs Target" slideNum={slideNum} total={total}>
      <div style={{ display: 'flex', gap: 96, alignItems: 'center', height: '100%' }}>
        <div style={{ flex: 1 }}>
          <div style={S.statLabel}>Leads MTD</div>
          <div style={{ ...S.bigStat, color: onPace ? S.success : '#FDF7EA' }}>{totalLeads}</div>
          {targetLeads != null && (
            <div style={{ fontSize: 32, opacity: 0.7, marginTop: 16 }}>
              Target: {targetLeads} · {pct}% of goal
            </div>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32 }}>
          <SplitRow label="Self-Generated (SGL)" value={data.sglFunnel.leads} accent={S.orange} />
          <SplitRow label="Non-SGL (Web)" value={data.nonSglFunnel.leads} accent="#1DD0FD" />
          <div style={{ borderTop: '1px solid #D7D7D720', paddingTop: 32 }}>
            <SplitRow label="Booked → Showed" value={data.sglFunnel.showed + data.nonSglFunnel.showed} accent="#FDF7EA" />
            <div style={{ height: 20 }} />
            <SplitRow label="Sold" value={data.sglFunnel.sold + data.nonSglFunnel.sold} accent={S.success} />
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

function SplitRow({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 28, color: '#D7D7D7', opacity: 0.8 }}>{label}</span>
      <span style={{ fontSize: 80, fontWeight: 900, letterSpacing: '-0.04em', color: accent }}>{value}</span>
    </div>
  );
}
