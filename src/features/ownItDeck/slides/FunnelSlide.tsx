import { SlideFrame, SlideStyles as S } from '../SlideFrame';
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
    { label: 'Showed', value: funnel.showed, delta: pct(funnel.showed, funnel.booked) + ' show rate' },
    { label: 'Sold', value: funnel.sold, delta: pct(funnel.sold, funnel.showed) + ' close rate' },
  ];
  return (
    <SlideFrame kicker={kicker} title={title} slideNum={slideNum} total={total}>
      {subtitle && (
        <div style={{ ...S.bodySm, color: '#D7D7D7', opacity: 0.7, marginBottom: 32 }}>
          {subtitle}
        </div>
      )}
      <div style={{ display: 'flex', gap: 40, alignItems: 'stretch', height: 640 }}>
        {steps.map((s, i) => (
          <div key={s.label} style={{
            flex: 1,
            border: `2px solid ${i === 0 ? S.orange : '#D7D7D720'}`,
            borderRadius: 24,
            padding: 48,
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: i === 0 ? '#FF6F0D18' : 'transparent',
          }}>
            <div style={S.statLabel}>{s.label}</div>
            <div style={{
              fontSize: 180, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em',
              color: '#FDF7EA', textAlign: 'center',
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: 24, color: '#D7D7D7', opacity: 0.7, minHeight: 32 }}>
              {s.delta ?? ''}
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}
