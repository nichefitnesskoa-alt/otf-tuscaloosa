import { SlideFrame } from '../SlideFrame';
import type { DeckData } from '../useDeckData';

export function Slide08ActionItems({ data, slideNum, total }: { data: DeckData; slideNum: number; total: number }) {
  const items = data.openActions;
  const today = new Date().toISOString().slice(0, 10);

  // Group by owner
  const byOwner = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byOwner.get(it.owner_name) || [];
    arr.push(it);
    byOwner.set(it.owner_name, arr);
  }
  const groups = [...byOwner.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <SlideFrame kicker="Accountability" title={`Open Action Items (${items.length})`} slideNum={slideNum} total={total}>
      {items.length === 0 ? (
        <div style={{ fontSize: 40, opacity: 0.7 }}>🎉 Nothing open. Every action item is done.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxHeight: '100%', overflow: 'hidden' }}>
          {groups.slice(0, 10).map(([owner, list]) => {
            const overdue = list.some(a => a.due_date && a.due_date < today);
            return (
              <div key={owner} style={{
                border: `1px solid ${overdue ? '#EF444460' : '#D7D7D730'}`,
                borderLeft: `6px solid ${overdue ? '#EF4444' : '#FF6F0D'}`,
                borderRadius: 12, padding: '18px 22px',
                background: overdue ? '#EF444408' : '#FDF7EA05',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: overdue ? '#EF4444' : '#FF6F0D' }}>{owner}</span>
                  <span style={{ fontSize: 16, opacity: 0.65 }}>{list.length} open</span>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.slice(0, 3).map(a => {
                    const past = a.due_date && a.due_date < today;
                    return (
                      <li key={a.id} style={{
                        fontSize: 18, lineHeight: 1.28, color: '#FDF7EA',
                        display: 'flex', justifyContent: 'space-between', gap: 12,
                      }}>
                        <span style={{ flex: 1 }}>{a.description}</span>
                        <span style={{
                          whiteSpace: 'nowrap', fontSize: 14,
                          color: past ? '#EF4444' : '#D7D7D7', opacity: past ? 1 : 0.6, fontWeight: past ? 800 : 400,
                        }}>
                          due {a.due_date}
                        </span>
                      </li>
                    );
                  })}
                  {list.length > 3 && (
                    <li style={{ fontSize: 14, opacity: 0.55 }}>+ {list.length - 3} more…</li>
                  )}
                </ul>
              </div>
            );
          })}
          {groups.length > 10 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.6, fontSize: 22 }}>
              + {groups.length - 10} more owners with open items…
            </div>
          )}
        </div>
      )}
    </SlideFrame>
  );
}
