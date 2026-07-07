import { SlideFrame, SlideStyles as S } from '../SlideFrame';
import { DrillPanel, DrillStat } from '../DrillOverlay';
import type { OwnerFull } from '../useDeckData';

export function SlideOwner({
  owner, slideNum, total,
}: {
  owner: OwnerFull;
  slideNum: number;
  total: number;
}) {
  const e = owner.entry;
  const submitted = owner.submitted;
  const kicker = `Owner · ${owner.lane_name || 'No lane'}`;
  const statusColor = submitted ? S.success : S.danger;
  const submittedAt = e?.submitted_at
    ? new Date(e.submitted_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : null;

  const drill = (
    <DrillPanel title={`${owner.display_name} — Full entry`} subtitle={owner.lane_name || undefined}>
      <FullEntryDrill owner={owner} />
    </DrillPanel>
  );

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
          {' · '}Press D for full entry
        </span>
      }
    >
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
            <div style={S.statLabel}>This week's commitment</div>
            <div style={{
              fontSize: 44, lineHeight: 1.22, color: '#FDF7EA', fontWeight: 700,
              marginTop: 12, flex: 1, overflow: 'hidden',
            }}>
              {e?.commitment?.trim()
                || (owner.priorCommitment
                  ? <span style={{ opacity: 0.65, fontStyle: 'italic' }}>
                      Last week: “{owner.priorCommitment}”
                    </span>
                  : <span style={{ opacity: 0.5 }}>—</span>)}
            </div>
            {e?.serves_wig && (
              <div style={{ marginTop: 20, fontSize: 22, color: '#FF6F0D', fontWeight: 700, letterSpacing: '0.06em' }}>
                Serves WIG → {e.serves_wig}
              </div>
            )}
          </div>
        </DrillStat>

        {/* Right column: prior + focus + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
          <Card label="Prior week">
            {e?.prior_status ? (
              <div>
                <StatusChip status={e.prior_status} />
                {e.prior_result && (
                  <div style={{ marginTop: 10, fontSize: 22, lineHeight: 1.3, opacity: 0.9 }}>{e.prior_result}</div>
                )}
                {e.prior_learning && (
                  <div style={{ marginTop: 6, fontSize: 20, lineHeight: 1.3, opacity: 0.7, fontStyle: 'italic' }}>
                    Learning: {e.prior_learning}
                  </div>
                )}
              </div>
            ) : <Empty>Nothing logged</Empty>}
          </Card>

          <Card label="This week focus">
            {e?.this_week_focus?.trim()
              ? <div style={{ fontSize: 22, lineHeight: 1.3 }}>{e.this_week_focus}</div>
              : <Empty>—</Empty>}
          </Card>

          <Card label={`Open action items (${owner.openActions.length})`}>
            {owner.openActions.length === 0
              ? <Empty>All clear</Empty>
              : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {owner.openActions.slice(0, 4).map(a => {
                    const overdue = a.due_date && a.due_date < new Date().toISOString().slice(0,10);
                    return (
                      <li key={a.id} style={{ fontSize: 20, lineHeight: 1.3, display: 'flex', gap: 10 }}>
                        <span style={{ color: overdue ? '#EF4444' : '#FF6F0D', fontWeight: 800 }}>•</span>
                        <span style={{ flex: 1 }}>{a.description}</span>
                        <span style={{ opacity: 0.55, fontSize: 16, whiteSpace: 'nowrap' }}>{a.due_date}</span>
                      </li>
                    );
                  })}
                  {owner.openActions.length > 4 && (
                    <li style={{ fontSize: 16, opacity: 0.55 }}>+ {owner.openActions.length - 4} more…</li>
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
      border: '1px solid #D7D7D720', borderRadius: 14, padding: '18px 22px',
      background: '#FDF7EA05', flex: 1, minHeight: 0, overflow: 'hidden',
    }}>
      <div style={{ ...S.statLabel, fontSize: 18, marginBottom: 8 }}>{label}</div>
      <div style={{ color: '#FDF7EA' }}>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span style={{ opacity: 0.5, fontSize: 20 }}>{children}</span>;
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
  const e = owner.entry;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
      <Section title="Prior status">
        {e?.prior_status
          ? <>{e.prior_status.toUpperCase()}{e.prior_result ? ` — ${e.prior_result}` : ''}</>
          : '—'}
      </Section>
      <Section title="Prior learning">{e?.prior_learning || '—'}</Section>
      <Section title="Last week update">{e?.last_week_update || '—'}</Section>
      <Section title="This week focus">{e?.this_week_focus || '—'}</Section>
      <Section title="Commitment">{e?.commitment || (owner.priorCommitment ? `(prior) ${owner.priorCommitment}` : '—')}</Section>
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
