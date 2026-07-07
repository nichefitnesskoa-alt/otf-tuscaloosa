import { SlideFrame } from '../SlideFrame';
import type { DeckData } from '../useDeckData';

export function Slide08ActionItems({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const items = data.openActions;
  return (
    <SlideFrame kicker="Accountability" title={`Open Action Items (${items.length})`} slideNum={slideNum} total={total}>
      {items.length === 0 ? (
        <div style={{ fontSize: 40, opacity: 0.7 }}>🎉 Nothing open. Every action item is done.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxHeight: '100%', overflow: 'hidden' }}>
          {items.slice(0, 12).map(a => (
            <div key={a.id} style={{
              border: '1px solid #D7D7D730', borderLeft: '6px solid #FF6F0D',
              borderRadius: 12, padding: '20px 24px', background: '#FDF7EA08',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#FF6F0D' }}>{a.owner_name}</span>
                <span style={{ fontSize: 18, opacity: 0.6 }}>Due {a.due_date}</span>
              </div>
              <div style={{ fontSize: 22, lineHeight: 1.3, color: '#FDF7EA' }}>{a.description}</div>
              <div style={{ marginTop: 8, fontSize: 16, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {a.status.replace('_', ' ')}
              </div>
            </div>
          ))}
          {items.length > 12 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.6, fontSize: 22 }}>
              + {items.length - 12} more…
            </div>
          )}
        </div>
      )}
    </SlideFrame>
  );
}
