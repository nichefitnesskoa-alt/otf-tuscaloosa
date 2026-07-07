import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import { DrillPanel, DrillStat } from '../DrillOverlay';
import type { OwnerFull } from '../useDeckData';
import type { OwnerEntry } from '@/hooks/useTheTable';

export function SlideOwner({
  owner, slideNum, total,
}: {
  owner: OwnerFull;
  slideNum: number;
  total: number;
}) {
  const submitted = owner.submitted;
  // Fall back to prior meeting entry when this-week entry is missing/empty.
  const e: OwnerEntry | null = owner.entry ?? owner.priorEntry;
  const isFallback = !owner.entry && !!owner.priorEntry;

  const kicker = `Owner · ${owner.lane_name || 'No lane'}`;
  const statusColor = submitted ? S.success : S.danger;
  const submittedAt = owner.entry?.submitted_at
    ? new Date(owner.entry.submitted_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : null;

  const drill = (
    <DrillPanel title={`${owner.display_name} — Full entry`} subtitle={owner.lane_name || undefined}>
      <FullEntryDrill owner={owner} />
    </DrillPanel>
  );

  const commitmentText = e?.commitment?.trim();
  const focusText = e?.this_week_focus?.trim();
  const ideasText = e?.ideas?.trim();
  const askText = e?.ask?.trim();

  return (
    <SlideFrame
      kicker={kicker}
      title={owner.display_name}
      slideNum={slideNum}
      total={total}
      footer={
        <span>
          <span style={{ color: statusColor, fontWeight: 800 }}>
            {submitted ? '● Locked in' : '● Not submitted'}
          </span>
          {submittedAt && <span style={{ opacity: 0.7 }}> · {submittedAt}</span>}
          {isFallback && <span style={{ opacity: 0.7 }}> · Showing last week's entry</span>}
          {' · '}Press D for full entry
        </span>
      }
    >
      {isFallback && (
        <div style={{
          marginBottom: 20, padding: '10px 18px',
          border: '1px solid #FBBF2460', background: '#FBBF2412', borderRadius: 10,
          color: '#FBBF24', fontSize: 20, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          No submission this week — showing last week's entry
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 40, height: '100%' }}>
        {/* Left: commitment hero */}
        <DrillStat drill={drill}>
          <div style={{
            border: `2px solid ${submitted ? '#34D39960' : '#EF444460'}`,
            borderLeft: `10px solid ${submitted ? '#34D399' : '#EF4444'}`,
            borderRadius: 20, padding: '36px 40px',
            background: submitted ? '#34D39908' : '#EF444408',
            height: '100%', display: 'flex', flexDirection: 'column',
          }}>
            <div style={S.statLabel}>{isFallback ? "Last week's commitment" : "This week's commitment"}</div>
            <div style={{
              fontSize: 44, lineHeight: 1.22, color: '#FDF7EA', fontWeight: 700,
              marginTop: 12, flex: 1, overflow: 'hidden',
              fontStyle: isFallback ? 'italic' : 'normal',
              opacity: isFallback ? 0.85 : 1,
            }}>
              {commitmentText || <span style={{ opacity: 0.5 }}>— Nothing on the books —</span>}
            </div>
            {e?.serves_wig && (
              <div style={{ marginTop: 20, fontSize: 22, color: '#FF6F0D', fontWeight: 700, letterSpacing: '0.06em' }}>
                Serves WIG → {e.serves_wig}
              </div>
            )}
          </div>
        </DrillStat>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
          <Card label="Prior week">
            {e?.prior_status || e?.prior_result || e?.prior_learning ? (
              <div>
                {e.prior_status && <StatusChip status={e.prior_status} />}
                {e.prior_result && (
                  <div style={{ marginTop: 10, fontSize: 20, lineHeight: 1.3, opacity: 0.9 }}>{e.prior_result}</div>
                )}
                {e.prior_learning && (
                  <div style={{ marginTop: 6, fontSize: 18, lineHeight: 1.3, opacity: 0.7, fontStyle: 'italic' }}>
                    Learning: {e.prior_learning}
                  </div>
                )}
              </div>
            ) : <Empty>Nothing logged</Empty>}
          </Card>

          {focusText && (
            <Card label="This week focus">
              <div style={{ fontSize: 20, lineHeight: 1.3 }}>{focusText}</div>
            </Card>
          )}

          {ideasText && (
            <Card label="Ideas">
              <div style={{ fontSize: 20, lineHeight: 1.3 }}>{ideasText}</div>
            </Card>
          )}

          {askText && (
            <Card label="Ask">
              <div style={{ fontSize: 20, lineHeight: 1.3 }}>{askText}</div>
            </Card>
          )}

          <Card label={`Open action items (${owner.openActions.length})`}>
            {owner.openActions.length === 0
              ? <Empty>All clear</Empty>
              : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {owner.openActions.slice(0, 4).map(a => {
                    const overdue = a.due_date && a.due_date < new Date().toISOString().slice(0,10);
                    return (
                      <li key={a.id} style={{ fontSize: 18, lineHeight: 1.3, display: 'flex', gap: 10 }}>
                        <span style={{ color: overdue ? '#EF4444' : '#FF6F0D', fontWeight: 800 }}>•</span>
                        <span style={{ flex: 1 }}>{a.description}</span>
                        <span style={{ opacity: 0.55, fontSize: 15, whiteSpace: 'nowrap' }}>{a.due_date}</span>
                      </li>
                    );
                  })}
                  {owner.openActions.length > 4 && (
                    <li style={{ fontSize: 15, opacity: 0.55 }}>+ {owner.openActions.length - 4} more…</li>
                  )}
                </ul>
              )}
          </Card>
        </div>
      </div>
    </SlideFrame>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: '1px solid #D7D7D720', borderRadius: 14, padding: '16px 20px',
      background: '#FDF7EA05', minHeight: 0, overflow: 'hidden',
    }}>
      <div style={{ ...S.statLabel, fontSize: 16, marginBottom: 6 }}>{label}</div>
      <div style={{ color: '#FDF7EA' }}>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span style={{ opacity: 0.5, fontSize: 18 }}>{children}</span>;
}

function StatusChip({ status }: { status: 'kept' | 'broken' }) {
  const kept = status === 'kept';
  return (
    <span style={{
      display: 'inline-block', padding: '6px 14px', borderRadius: 999,
      fontSize: 16, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
      background: kept ? '#34D39918' : '#EF444418',
      color: kept ? '#34D399' : '#EF4444',
      border: `1px solid ${kept ? '#34D39960' : '#EF444460'}`,
    }}>
      {kept ? '✓ Kept commitment' : '✗ Broken'}
    </span>
  );
}

function FullEntryDrill({ owner }: { owner: OwnerFull }) {
  const e = owner.entry ?? owner.priorEntry;
  const isFallback = !owner.entry && !!owner.priorEntry;
  return (
    <div>
      {isFallback && (
        <div style={{
          marginBottom: 20, padding: '10px 16px',
          border: '1px solid #FBBF2460', background: '#FBBF2412', borderRadius: 10,
          color: '#FBBF24', fontSize: 18, fontWeight: 700,
        }}>
          Fallback — no submission this week; showing last week's entry.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <Section title="Prior status">
          {e?.prior_status
            ? <>{e.prior_status.toUpperCase()}{e.prior_result ? ` — ${e.prior_result}` : ''}</>
            : '—'}
        </Section>
        <Section title="Prior learning">{e?.prior_learning || '—'}</Section>
        <Section title="Last week update">{e?.last_week_update || '—'}</Section>
        <Section title="This week focus">{e?.this_week_focus || '—'}</Section>
        <Section title="Commitment">{e?.commitment || '—'}</Section>
        <Section title="Serves WIG">{e?.serves_wig || '—'}</Section>
        <Section title="Ideas">{e?.ideas || '—'}</Section>
        <Section title="Ask">{e?.ask || '—'}</Section>
        <Section title={`Open action items (${owner.openActions.length})`}>
          {owner.openActions.length === 0
            ? '—'
            : (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {owner.openActions.map(a => (
                  <li key={a.id}>{a.description} <span style={{ opacity: 0.6 }}>· due {a.due_date} · {a.status}</span></li>
                ))}
              </ul>
            )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 18, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: '#FF6F0D', fontWeight: 800, marginBottom: 6,
      }}>{title}</div>
      <div style={{ fontSize: 22, lineHeight: 1.32 }}>{children}</div>
    </div>
  );
}
