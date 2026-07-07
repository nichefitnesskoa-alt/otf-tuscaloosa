import { SlideFrame } from '../SlideFrame';
import type { DeckData } from '../useDeckData';

export function Slide09OwnerCommitments({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const owners = data.owners;
  const submitted = owners.filter(o => o.submitted).length;

  return (
    <SlideFrame
      kicker="This Week"
      title="Owner Commitments"
      slideNum={slideNum}
      total={total}
      footer={`${submitted} of ${owners.length} locked in`}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxHeight: '100%', overflow: 'hidden' }}>
        {owners.slice(0, 12).map(o => (
          <div key={o.id} style={{
            border: `1px solid ${o.submitted ? '#34D39960' : '#EF444460'}`,
            borderLeft: `6px solid ${o.submitted ? '#34D399' : '#EF4444'}`,
            borderRadius: 12, padding: '18px 24px',
            background: o.submitted ? '#34D39908' : '#EF444408',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 900 }}>{o.display_name}</span>
              <span style={{
                fontSize: 14, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: o.submitted ? '#34D399' : '#EF4444',
              }}>
                {o.submitted ? 'Locked in' : 'Not submitted'}
              </span>
            </div>
            <div style={{ fontSize: 16, opacity: 0.7, marginBottom: 10 }}>{o.lane_name || 'No lane'}</div>
            <div style={{ fontSize: 22, lineHeight: 1.28, color: '#FDF7EA', maxHeight: 130, overflow: 'hidden' }}>
              {o.commitment?.trim() || (o.submitted ? '(no commitment written)' : '—')}
            </div>
          </div>
        ))}
        {owners.length > 12 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.6, fontSize: 22 }}>
            + {owners.length - 12} more owners…
          </div>
        )}
      </div>
    </SlideFrame>
  );
}
