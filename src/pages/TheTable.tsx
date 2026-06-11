import { isAdmin as isAdminCheck } from '@/lib/auth/roles';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Flag, Plus, ChevronLeft, ChevronRight, ChevronDown, Settings, History, Trophy, Check, X, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/dateUtils';
import {
  useCurrentMeeting, useActiveOwners, useArchitect, useOwnerEntries, useActionItems,
  useOpenCarryForward, useCurrentWeekWins, useTableClose, useLaneHealth, useTableRealtime,
  usePriorOwnerEntries,
  nextMondayCT,
  type OwnerEntry, type TableOwner,
} from '@/hooks/useTheTable';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { ManageOwnersDialog } from '@/components/table/ManageOwnersDialog';
import { MentionInput } from '@/components/shared/MentionInput';
import { MentionText } from '@/components/shared/MentionText';
import { OwnItMentionsCard } from '@/components/shared/OwnItMentionsCard';
import { SaWeeklyGoals } from '@/components/table/SaWeeklyGoals';
import { ExportTeamMeetingButton } from '@/components/table/ExportTeamMeetingButton';
import { LANE_SUGGESTIONS } from '@/lib/table/laneSuggestions';
import { useRecentLaneCompleteness } from '@/lib/table/laneCompletion';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate, useParams } from 'react-router-dom';

const HEALTH_DOT: Record<string, string> = {
  green: 'bg-success', amber: 'bg-warning', red: 'bg-danger',
};

// Convert "13:30" / "13:30:00" → "1:30 PM" (no military time anywhere).
function formatMeetingTime(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
}

// Shift a YYYY-MM-DD date by N days (UTC math, output safe for Monday-anchored CT keys).
function shiftDate(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export default function TheTable() {
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { meetingId: paramMeetingId } = useParams<{ meetingId?: string }>();

  const currentMonday = nextMondayCT();
  const [weekDate, setWeekDate] = useState<string>(currentMonday);

  const { data: meeting, isLoading } = useCurrentMeeting({ meetingId: paramMeetingId, weekDate });
  const { data: owners = [] } = useActiveOwners();
  const { data: architect } = useArchitect();
  const { data: entries = [] } = useOwnerEntries(meeting?.id);
  const { data: priorEntries = [] } = usePriorOwnerEntries(meeting?.meeting_date);
  
  const { data: actions = [] } = useActionItems(meeting?.id);
  const { data: carryForward = [] } = useOpenCarryForward(meeting?.id);
  const { data: wins = [] } = useCurrentWeekWins(meeting?.meeting_date);
  const { data: closeRow } = useTableClose(meeting?.id);
  const laneHealth = useLaneHealth(meeting?.id, meeting?.meeting_date);
  useTableRealtime(meeting?.id);
  const { staff: allStaff, salesAssociates } = useActiveStaff();

  // Live WIG label for the "How this serves the WIG" prompt — reads the same
  // monthly studio target as the WIG tab, and computes team SGL as
  // per-SA SGL target × active SA count. Falls back to a neutral label if
  // either value is unset so we never display a stale hardcoded number.
  const [wigSuffix, setWigSuffix] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { loadMonthlyTargets } = await import('@/lib/wig/targets');
      const yyyymm = (meeting?.meeting_date ?? weekDate).slice(0, 7);
      const t = await loadMonthlyTargets(yyyymm);
      if (cancelled) return;
      const teamSgl = t.saSgl != null && salesAssociates.length > 0
        ? t.saSgl * salesAssociates.length : null;
      if (t.studioLeads != null && teamSgl != null) {
        setWigSuffix(` (${t.studioLeads} leads, ${teamSgl} self-generated)`);
      } else if (t.studioLeads != null) {
        setWigSuffix(` (${t.studioLeads} leads this month)`);
      } else {
        setWigSuffix('');
      }
    })();
    return () => { cancelled = true; };
  }, [meeting?.meeting_date, weekDate, salesAssociates.length]);

  // Coach-owned lanes get a close-rate example in the WIG-connection prompt;
  // other lanes keep the neutral leads-funnel example.
  const coachStaffIds = useMemo(
    () => new Set(allStaff.filter(s => ['Coach', 'Both', 'Admin'].includes(s.role)).map(s => s.id)),
    [allStaff],
  );



  const [manageOpen, setManageOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [winText, setWinText] = useState('');
  

  // Self owner records (one row per lane). Architect doesn't appear here, so Koa never has any.
  const myOwners = owners.filter(o => o.display_name === user?.name);
  const myEntries = entries.filter(e => myOwners.some(o => o.id === e.owner_id));
  const allMySubmitted = myOwners.length > 0 && myOwners.every(o => myEntries.find(e => e.owner_id === o.id)?.submitted_at);
  const isArchitectViewer = !!architect && architect.display_name === user?.name;
  const architectEntry = architect && entries.find(e => e.owner_id === architect.id);

  // Default owner_id for "Log a win" composer when user holds 2+ lanes
  const [winOwnerId, setWinOwnerId] = useState<string | null>(null);
  const effectiveWinOwnerId = winOwnerId ?? myOwners[0]?.id ?? null;

  // Refresh helper — stable identity so child effects don't re-run on every render
  const refresh = useCallback(
    (key: string) => qc.invalidateQueries({ queryKey: [key, meeting?.id] }),
    [qc, meeting?.id],
  );
  const onEntryChange = useCallback(() => refresh('table-entries'), [refresh]);

  // Effective week being viewed (deep-linked meetings override the stepper).
  const effectiveWeek = meeting?.meeting_date ?? weekDate;
  const phase: 'past' | 'current' | 'future' =
    effectiveWeek < currentMonday ? 'past' : effectiveWeek > currentMonday ? 'future' : 'current';
  const phaseLabel = phase === 'past' ? 'Past' : phase === 'future' ? 'Upcoming' : 'This week';

  const stepWeek = (delta: number) => {
    if (paramMeetingId) navigate('/the-table');
    setWeekDate(w => shiftDate(w, delta));
  };
  const goToToday = () => {
    if (paramMeetingId) navigate('/the-table');
    setWeekDate(currentMonday);
  };

  // ---------- Header ----------
  const header = (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="w-6 h-6 text-brand" /> Own It
          </h1>
        </div>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          {meeting && <ExportTeamMeetingButton meetingId={meeting.id} meetingDate={meeting.meeting_date} />}
          <Button variant="outline" size="sm" onClick={() => navigate('/the-table/history')}>
            <History className="w-4 h-4 mr-1" /> Past Meetings
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              <Settings className="w-4 h-4 mr-1" /> Manage Owners
            </Button>
          )}
        </div>
      </div>
      {/* Week stepper — everyone can move */}
      <div className="flex items-center justify-between gap-2 border rounded-md px-2 py-2 bg-muted/30">
        <Button variant="ghost" size="sm" onClick={() => stepWeek(-7)} aria-label="Previous week">
          <ChevronLeft className="w-4 h-4 mr-1" /> Prev week
        </Button>
        <div className="text-center">
          <div className="font-semibold text-sm">
            Week of {format(new Date(effectiveWeek + 'T12:00:00'), 'EEE, MMM d')}
          </div>
          <div className="text-xs text-muted-foreground">
            {meeting ? `${formatMeetingTime(meeting.meeting_time)} · ` : ''}
            <Badge variant="secondary" className="ml-1">{phaseLabel}</Badge>
            {effectiveWeek !== currentMonday && (
              <button onClick={goToToday} className="ml-2 text-brand underline text-xs">Today</button>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => stepWeek(7)} aria-label="Next week">
          Next week <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!meeting) {
    return (
      <div className="p-4 max-w-4xl mx-auto pb-24">
        {header}
        <Card className="p-8 text-center text-muted-foreground">
          No Own It record for the week of {format(new Date(effectiveWeek + 'T12:00:00'), 'MMM d, yyyy')}.
        </Card>
      </div>
    );
  }

  // ---------- Carry-forward ----------
  const carryBlock = carryForward.length > 0 && (
    <Card className="p-4 mb-4 border-warning/40 bg-warning-dim/40 dark:bg-warning/20">
      <div className="font-semibold mb-2 text-sm">Open from prior weeks ({carryForward.length})</div>
      <div className="space-y-1">
        {carryForward.slice(0, 6).map(a => {
          const dueDate = parseLocalDate(a.due_date);
          const overdue = dueDate ? dueDate < new Date() : false;
          return (
            <div key={a.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1">
              <div className="flex-1 truncate">
                <span className="font-medium">{a.owner_name}:</span> {a.description}
              </div>
              <div className={cn('text-xs', overdue && 'text-danger font-semibold')}>
                {dueDate ? format(dueDate, 'MMM d') : ''}
              </div>
              <Select value={a.status} onValueChange={async (v) => {
                await supabase.from('table_action_items').update({ status: v }).eq('id', a.id);
                qc.invalidateQueries({ queryKey: ['table-actions-open'] });
              }}>
                <SelectTrigger className="w-[110px] ml-2 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </Card>
  );

  // ---------- Wins logger (always visible) ----------
  const winButton = (
    <Button variant="outline" size="sm" onClick={() => setWinOpen(true)}>
      <Trophy className="w-4 h-4 mr-1 text-warning" /> Log a win this week
    </Button>
  );

  // ---------- Pre-meeting view ----------
  const preMeetingView = (
    <>
      {/* Studio Leader — Architect (separate from Owner grid) */}
      {architect && (
        <ArchitectOpenNote
          meetingId={meeting.id}
          architectName={architect.display_name}
          initialNote={meeting.koa_open_note ?? ''}
          canEdit={isArchitectViewer}
          onSaved={() => qc.invalidateQueries({ queryKey: ['table-meeting'] })}
        />
      )}

      {/* Self-serve lanes manager — any staff member can claim/change/add their lanes */}
      {!isArchitectViewer && (
        <MyLanesManager myOwners={myOwners} onChanged={() => qc.invalidateQueries({ queryKey: ['table-owners'] })} />
      )}

      {/* Owner self-entry — one collapsible card per lane the user owns */}
      {myOwners.map(mine => {
        const myEntry = entries.find(e => e.owner_id === mine.id);
        const myPrior = priorEntries.find(e => e.owner_id === mine.id);
        return (
          <CollapsibleUpdateCard
            key={mine.id}
            laneName={mine.lane_name}
            locked={!!myEntry?.submitted_at}
          >
            <p className="text-xs text-muted-foreground mb-3">This is your WIG update. Be specific and real.</p>
            <OwnerEntryForm
              meetingId={meeting.id}
              ownerId={mine.id}
              entry={myEntry}
              priorEntry={myPrior}
              onChange={onEntryChange}
              wigSuffix={wigSuffix}
              isCoachLane={coachStaffIds.has(mine.staff_id)}
            />

          </CollapsibleUpdateCard>
        );
      })}

      {/* What the Owners brought — single roster of every owner (self + peers) */}
      <Card className="p-4 mb-4">
        <div className="font-semibold mb-3">What the Owners brought</div>
        <div className="space-y-3">
          {owners.map(o => {
            const e = entries.find(en => en.owner_id === o.id);
            return (
              <div key={o.id} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="font-medium text-sm">{o.display_name} · {o.lane_name || '—'}</div>
                  <Badge
                    variant={e?.submitted_at ? 'default' : 'outline'}
                    className={e?.submitted_at ? 'bg-success text-[10px]' : 'text-warning border-warning text-[10px]'}
                  >
                    {e?.submitted_at ? 'Locked in' : 'Not yet'}
                  </Badge>
                </div>
                {e?.submitted_at ? (
                  <PeerEntry entry={e} />
                ) : (
                  <div className="text-xs text-muted-foreground italic">Not locked in yet</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );


  // ---------- Complete view ----------
  const completeView = (
    <>
      <Card className="p-4 mb-4">
        <div className="font-semibold mb-2">Action items ({actions.length})</div>
        {actions.length === 0 && <div className="text-sm text-muted-foreground mb-2">No action items yet.</div>}
        <div className="space-y-1">
          {actions.map(a => (
            <ActionItemRow
              key={a.id}
              item={a}
              onChanged={() => refresh('table-actions')}
            />
          ))}
        </div>
        <AddActionItemForm
          meetingId={meeting.id}
          createdBy={user?.name ?? 'system'}
          onAdded={() => refresh('table-actions')}
        />
      </Card>
    </>
  );


  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      {header}
      <OwnItMentionsCard variant="banner" />

      {carryBlock}

      {/* ───── BEAT 1 — SCOREBOARD ───── */}
      <BeatHeader num={1} title="Scoreboard" subtitle="Where the WIG stands right now." />
      <SaWeeklyGoals weekStart={weekDate} />

      {/* ───── BEAT 2 — PLAN / COMMIT ───── */}
      <BeatHeader num={2} title="Commit" subtitle="Account for last week, then commit to this week." />
      <div className="mb-3 flex justify-between items-center">
        {winButton}
        <div className="text-xs text-muted-foreground">{wins.length} wins this week</div>
      </div>

      {/* Same layout for past / current / future — answers always visible on the page. */}
      {preMeetingView}
      {(actions.length > 0 || isAdmin) && (
        <div className="mt-6">
          <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">Action items & close</div>
          {completeView}
        </div>
      )}

      <ManageOwnersDialog open={manageOpen} onOpenChange={setManageOpen} />

      {/* Win logger */}
      <Dialog open={winOpen} onOpenChange={setWinOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>What happened worth celebrating?</DialogTitle></DialogHeader>
          {myOwners.length > 1 && (
            <Select value={effectiveWinOwnerId ?? undefined} onValueChange={setWinOwnerId}>
              <SelectTrigger><SelectValue placeholder="Which lane?" /></SelectTrigger>
              <SelectContent>
                {myOwners.map(o => <SelectItem key={o.id} value={o.id}>{o.lane_name || 'Unassigned'}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <MentionInput value={winText} onChange={setWinText} placeholder="Big or small — log it. Type @ to tag." className="min-h-[100px]" />
          <Button className="bg-brand hover:bg-brand-hover" onClick={async () => {
            if (!winText.trim() || !user?.name) return;
            await supabase.from('table_wins').insert({
              owner_id: effectiveWinOwnerId, owner_name: user.name,
              content: winText.trim(), meeting_week: meeting.meeting_date, created_by: user.name,
            });
            setWinText(''); setWinOpen(false); refresh('table-wins'); toast.success('Win logged');
          }}>Log win</Button>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ---------- Sub-components ----------

function MyLanesManager({ myOwners, onChanged }: { myOwners: TableOwner[]; onChanged: () => void }) {
  const { user } = useAuth();
  const { staff } = useActiveStaff();
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickerLane, setPickerLane] = useState('');
  const [commitOpen, setCommitOpen] = useState(false);
  const [pendingThirdConfirm, setPendingThirdConfirm] = useState(false);

  const me = staff.find(s => s.name === user?.name);
  const { data: completeness } = useRecentLaneCompleteness(me?.id);
  const blocked = !!completeness?.blocked;
  const hasNoLane = myOwners.length === 0;

  const updateLane = async (ownerId: string, lane: string) => {
    const trimmed = lane.trim();
    const match = LANE_SUGGESTIONS.find(s => s.lane.toLowerCase() === trimmed.toLowerCase());
    const category = match?.category ?? null;
    setSaving(true);
    const { error } = await supabase
      .from('table_owners')
      .update({ lane_name: trimmed || null, ...(category ? { category } : {}) })
      .eq('id', ownerId);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success('Lane updated'); onChanged(); }
  };

  const removeLane = async (ownerId: string) => {
    const { error } = await supabase.from('table_owners').update({ is_active: false }).eq('id', ownerId);
    if (error) toast.error(error.message); else { toast.success('Lane removed'); onChanged(); }
  };

  const startAddFlow = () => {
    if (blocked) return;
    if (myOwners.length >= 2) {
      setPendingThirdConfirm(true);
    } else {
      setCommitOpen(true);
    }
  };

  const confirmAddLane = async () => {
    const lane = pickerLane.trim();
    if (!lane) { toast.error('Pick a lane first.'); return; }
    if (!me) { toast.error('Your staff record is not active. Ask Koa to enable it.'); return; }
    const match = LANE_SUGGESTIONS.find(s => s.lane.toLowerCase() === lane.toLowerCase());
    const category = match?.category ?? null;
    setSaving(true);
    // Revive prior soft-removed (staff_id, lane_name) row if present.
    const { data: existing } = await supabase
      .from('table_owners').select('id').eq('staff_id', me.id).eq('lane_name', lane).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('table_owners').update({
        is_active: true, display_name: me.name, ...(category ? { category } : {}),
      }).eq('id', existing.id);
      if (error) toast.error(error.message); else toast.success(`Added — ${lane}`);
    } else {
      const { error } = await supabase.from('table_owners').insert({
        staff_id: me.id, display_name: me.name, is_active: true,
        lane_name: lane, ...(category ? { category } : {}),
        created_by: me.name,
      });
      if (error) toast.error(error.message); else toast.success(`Added — ${lane}`);
    }
    setSaving(false);
    setPickerLane('');
    setPicking(false);
    setCommitOpen(false);
    onChanged();
  };

  // Collapse once the user has at least one lane; expand to edit.
  const [expanded, setExpanded] = useState(hasNoLane);
  useEffect(() => { if (hasNoLane) setExpanded(true); }, [hasNoLane]);

  return (
    <>
      <Card className="p-4 mb-4 border-2 border-dashed border-brand/40">
        <button
          type="button"
          onClick={() => !hasNoLane && setExpanded(v => !v)}
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{hasNoLane ? 'Pick your Ownership Role' : 'Your Ownership Lanes'}</div>
            {!expanded && !hasNoLane && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {myOwners.map(o => o.lane_name || 'Unassigned').join(' · ')}
              </div>
            )}
            {expanded && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasNoLane ? 'Claim a lane to join Own It. You can change or add lanes later.' : 'You can hold multiple lanes. Each lane gets its own update.'}
              </p>
            )}
          </div>
          {!hasNoLane && (
            <ChevronDown className={cn('w-4 h-4 transition-transform shrink-0', expanded && 'rotate-180')} />
          )}
        </button>

        {expanded && (
          <div className="mt-3">
            {/* Existing lanes — editable */}
            <div className="space-y-2">
              {myOwners.map(o => (
                <div key={o.id} className="flex items-center gap-2 border rounded-md p-2">
                  <div className="flex-1">
                    <Input
                      defaultValue={o.lane_name ?? ''}
                      onBlur={(e) => e.target.value !== (o.lane_name ?? '') && updateLane(o.id, e.target.value)}
                      placeholder="e.g. IG Owner"
                      list={`my-lanes-${o.id}`}
                      disabled={saving}
                    />
                    <datalist id={`my-lanes-${o.id}`}>
                      {LANE_SUGGESTIONS.map(s => <option key={s.lane} value={s.lane}>{s.description}</option>)}
                    </datalist>
                    {o.category && <div className="text-[11px] text-muted-foreground mt-1">Category: {o.category}</div>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeLane(o.id)} title="Remove this lane">
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Initial-claim picker (no lanes yet) */}
            {hasNoLane && (
              <div className="mt-3">
                <Input
                  value={pickerLane}
                  onChange={(e) => setPickerLane(e.target.value)}
                  placeholder="Choose a role…"
                  list="my-lanes-initial"
                  disabled={saving}
                />
                <datalist id="my-lanes-initial">
                  {LANE_SUGGESTIONS.map(s => <option key={s.lane} value={s.lane}>{s.description}</option>)}
                </datalist>
                <Button className="mt-2 bg-brand hover:bg-brand-hover" onClick={confirmAddLane} disabled={!pickerLane.trim() || saving}>
                  Claim this lane
                </Button>
              </div>
            )}

            {/* Add another lane */}
            {!hasNoLane && (
              <div className="mt-3">
                <Button variant="outline" onClick={startAddFlow} disabled={blocked || saving}>
                  <Plus className="w-4 h-4 mr-1" /> Add another lane
                </Button>
                {blocked && (
                  <p className="text-xs text-muted-foreground mt-1">Complete your current lanes for two weeks first.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 3rd-lane heads-up confirm */}
      <Dialog open={pendingThirdConfirm} onOpenChange={setPendingThirdConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>That's a third lane</DialogTitle></DialogHeader>
          <p className="text-sm">Most people max out at 2 lanes — sure you can carry a third?</p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setPendingThirdConfirm(false)}>Not yet</Button>
            <Button className="bg-brand hover:bg-brand-hover" onClick={() => { setPendingThirdConfirm(false); setCommitOpen(true); }}>
              Keep going
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Commitment modal + lane picker */}
      <Dialog open={commitOpen} onOpenChange={(v) => { setCommitOpen(v); if (!v) { setPicking(false); setPickerLane(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>One more lane is a real commitment.</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>The room notices when a lane goes quiet. Two cards with half answers is harder to recover from than one card done well. The people who carry multiple lanes successfully aren't doing more — they're just clearer on what moves the needle in each one.</p>
            <p>Ask yourself one question before adding this: is your current lane moving every week without being reminded?</p>
            <p>If yes, you're probably ready.</p>
            <p className="italic text-muted-foreground">"Most people max out at two lanes. That's not a ceiling — that's just what the data shows."</p>
          </div>
          {!picking ? (
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="ghost" onClick={() => setCommitOpen(false)}>Not yet</Button>
              <Button className="bg-brand hover:bg-brand-hover" onClick={() => setPicking(true)}>Add the lane</Button>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              <Input
                autoFocus
                value={pickerLane}
                onChange={(e) => setPickerLane(e.target.value)}
                placeholder="Choose a lane…"
                list="my-lanes-add"
              />
              <datalist id="my-lanes-add">
                {LANE_SUGGESTIONS
                  .filter(s => !myOwners.some(o => (o.lane_name ?? '').toLowerCase() === s.lane.toLowerCase()))
                  .map(s => <option key={s.lane} value={s.lane}>{s.description}</option>)}
              </datalist>
              <Button className="w-full bg-brand hover:bg-brand-hover" onClick={confirmAddLane} disabled={!pickerLane.trim() || saving}>
                Add this lane
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EntryField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border rounded-md p-2">
      <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value || <span className="italic text-muted-foreground">Empty</span>}</div>
    </div>
  );
}

function PeerEntry({ entry }: { entry: OwnerEntry }) {
  const statusLabel = entry.prior_status === 'kept' ? 'Kept' : entry.prior_status === 'broken' ? 'Broken' : null;
  return (
    <div className="space-y-1 text-xs">
      {statusLabel && <div><b>Last week:</b> {statusLabel}</div>}
      {entry.prior_result && <div><b>Result:</b> <MentionText text={entry.prior_result} /></div>}
      {entry.prior_learning && <div><b>Learned:</b> <MentionText text={entry.prior_learning} /></div>}
      {entry.commitment && <div><b>This week:</b> <MentionText text={entry.commitment} /></div>}
      {entry.serves_wig && <div><b>Serves WIG:</b> <MentionText text={entry.serves_wig} /></div>}
      {entry.ask && <div><b>Needs:</b> <MentionText text={entry.ask} /></div>}
      {/* Legacy fields, kept for historical entries */}
      {entry.last_week_update && <div><b>Last week (legacy):</b> <MentionText text={entry.last_week_update} /></div>}
      {entry.this_week_focus && !entry.commitment && <div><b>This week:</b> <MentionText text={entry.this_week_focus} /></div>}
      {entry.ideas && <div><b>Ideas:</b> <MentionText text={entry.ideas} /></div>}
    </div>
  );
}


function OwnerEntryForm({ meetingId, ownerId, entry, priorEntry, onChange, wigSuffix = '', isCoachLane = false }: {
  meetingId: string; ownerId: string; entry?: OwnerEntry; priorEntry?: OwnerEntry; onChange: () => void;
  wigSuffix?: string; isCoachLane?: boolean;
}) {
  const [savedField, setSavedField] = useState<string | null>(null);
  const [entryId, setEntryId] = useState<string | undefined>(entry?.id);
  const locked = !!entry?.submitted_at;

  // Keep local entryId in sync when parent refetches.
  useEffect(() => { if (entry?.id) setEntryId(entry.id); }, [entry?.id]);

  // Latest onChange via ref so the seeding effect never re-runs because of
  // a new callback identity from the parent.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Ensure exactly one row exists for this (meeting, owner) before any
  // blur-save races. Runs once per (meeting_id, owner_id) pair.
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (entryId) return;
    const pairKey = `${meetingId}:${ownerId}`;
    if (seededRef.current === pairKey) return;
    seededRef.current = pairKey;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('table_owner_entries')
        .upsert(
          { meeting_id: meetingId, owner_id: ownerId, created_by: 'owner' },
          { onConflict: 'meeting_id,owner_id', ignoreDuplicates: false },
        )
        .select('id')
        .maybeSingle();
      if (cancelled) return;
      if (error) { toast.error(`Couldn't open your entry: ${error.message}`); return; }
      if (data?.id) { setEntryId(data.id); onChangeRef.current(); }
    })();
    return () => { cancelled = true; };
  }, [entryId, meetingId, ownerId]);

  const save = async (field: keyof OwnerEntry, value: string) => {
    const { data, error } = await supabase
      .from('table_owner_entries')
      .upsert(
        { meeting_id: meetingId, owner_id: ownerId, [field]: value, created_by: 'owner' },
        { onConflict: 'meeting_id,owner_id', ignoreDuplicates: false },
      )
      .select('id')
      .maybeSingle();
    if (error) { toast.error(`Save failed: ${error.message}`); return; }
    if (data?.id && !entryId) setEntryId(data.id);
    setSavedField(field as string);
    setTimeout(() => setSavedField(null), 2000);
    onChangeRef.current();
  };

  const saveStatus = async (next: 'kept' | 'broken') => {
    const { error } = await supabase
      .from('table_owner_entries')
      .upsert(
        { meeting_id: meetingId, owner_id: ownerId, prior_status: next, created_by: 'owner' },
        { onConflict: 'meeting_id,owner_id', ignoreDuplicates: false },
      );
    if (error) { toast.error(error.message); return; }
    setSavedField('prior_status');
    setTimeout(() => setSavedField(null), 2000);
    onChangeRef.current();
  };

  // Coach lanes are graded on close %, so their pressure-test example
  // points there. Everyone else keeps the leads-funnel example.
  const servesPlaceholder = isCoachLane
    ? 'e.g. tighter post-class debriefs → more SALE outcomes → close % up'
    : 'e.g. pickleball event → 30 locals in studio → VIP passes → leads';

  const fields: { key: keyof OwnerEntry; label: string; placeholder?: string }[] = [
    {
      key: 'commitment',
      label: 'What I commit to this week',
      placeholder: 'I commit to [action] by [day] to create [result]',
    },
    {
      key: 'serves_wig',
      label: `How this serves the WIG${wigSuffix}`,
      placeholder: servesPlaceholder,
    },
    {
      key: 'ask',
      label: 'What do you need to be successful in your commitment, and who can help?',
    },
  ];


  // resetKey ties the input's seeded text to the entry row id. Once the row
  // exists, re-renders from realtime invalidations no longer reset typed text.
  const resetKey = entry?.id ?? entryId ?? 'pending';

  const priorCommitment = (priorEntry?.commitment ?? '').trim();
  const priorStatus = entry?.prior_status ?? null;

  return (
    <div className="space-y-3">
      {/* Account beat — last week's commitment, what happened, what we learned */}
      <div className="rounded-md border-2 border-brand/30 bg-brand/5 p-3 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-brand font-bold">Account for last week</div>

        <div>
          <label className="text-xs font-medium block mb-1">Last week you committed to</label>
          {priorCommitment ? (
            <div className="text-sm whitespace-pre-wrap rounded-md bg-background/60 border p-2">
              <MentionText text={priorCommitment} />
            </div>
          ) : (
            <div className="text-xs italic text-muted-foreground rounded-md bg-background/40 border border-dashed p-2">
              No commitment from last week yet. This will auto-fill once you lock one in.
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">What was the result?</label>
          <MentionInput
            defaultValue={entry?.prior_result ?? ''}
            resetKey={resetKey}
            disabled={locked}
            placeholder="What actually happened. The number, the outcome, the real story."
            className="min-h-[60px] border-2"
            onBlur={(e: any) => e.target.value !== (entry?.prior_result ?? '') && save('prior_result', e.target.value)}
          />
          <div className="flex gap-2 mt-2 items-center">
            <span className="text-[11px] text-muted-foreground">Kept or broken?</span>
            <Button
              type="button"
              size="sm"
              variant={priorStatus === 'kept' ? 'default' : 'outline'}
              className={cn('h-7 text-xs', priorStatus === 'kept' && 'bg-success hover:bg-success/90')}
              disabled={locked}
              onClick={() => saveStatus('kept')}
            >
              <Check className="w-3 h-3 mr-1" /> Kept
            </Button>
            <Button
              type="button"
              size="sm"
              variant={priorStatus === 'broken' ? 'default' : 'outline'}
              className="h-7 text-xs"
              disabled={locked}
              onClick={() => saveStatus('broken')}
            >
              Broken
            </Button>
            {savedField === 'prior_status' && <span className="text-[11px] text-success">Saved</span>}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">What did you learn, good or bad?</label>
          <MentionInput
            defaultValue={entry?.prior_learning ?? ''}
            resetKey={resetKey}
            disabled={locked}
            placeholder="What worked, what didn't, and how it helps the team do it better. No wrong answers here."
            className="min-h-[60px] border-2"
            onBlur={(e: any) => e.target.value !== (entry?.prior_learning ?? '') && save('prior_learning', e.target.value)}
          />
          {savedField === 'prior_learning' && <span className="text-xs text-success">Saved</span>}
        </div>
      </div>

      {fields.map(f => {
        const val = (entry?.[f.key] as string) || '';
        const filled = val.trim().length > 0;
        return (
          <div key={f.key}>
            <label className="text-xs font-medium block mb-1">{f.label}</label>
            <MentionInput
              defaultValue={val}
              resetKey={resetKey}
              disabled={locked}
              placeholder={f.placeholder}
              className={cn(
                'min-h-[70px] border-2',
                filled ? 'border-success/40' : 'border-warning/40',
              )}
              onBlur={(e: any) => e.target.value !== val && save(f.key, e.target.value)}
            />
            {savedField === f.key && <span className="text-xs text-success">Saved</span>}
          </div>
        );
      })}
      {!locked && (
        <Button
          className="w-full bg-brand hover:bg-brand-hover"
          onClick={async () => {
            const id = entry?.id ?? entryId;
            if (!id) { toast.error("Hang on — still opening your entry. Try again in a sec."); return; }
            const { error } = await supabase
              .from('table_owner_entries')
              .update({ submitted_at: new Date().toISOString() })
              .eq('id', id);
            if (error) { toast.error(`Lock in failed: ${error.message}`); return; }
            onChange(); toast.success('Locked in.');
          }}
        >
          <Check className="w-4 h-4 mr-1" /> Lock in my update
        </Button>
      )}
    </div>
  );
}


function ArchitectOpenNote({ meetingId, architectName, initialNote, canEdit, onSaved }: {
  meetingId: string; architectName: string; initialNote: string; canEdit: boolean; onSaved: () => void;
}) {
  const [note, setNote] = useState(initialNote);
  const [preview, setPreview] = useState(false);

  useEffect(() => { setNote(initialNote); }, [initialNote]);

  const save = async (val: string) => {
    await supabase.from('table_meetings').update({ koa_open_note: val }).eq('id', meetingId);
    onSaved();
  };

  return (
    <Card className="p-4 mb-4 border-2 border-brand/60 bg-brand/5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-brand font-bold">Studio Leader — Architect</div>
          <div className="text-lg font-bold">{architectName}</div>
        </div>
        {canEdit && (
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => {
              if (preview) { setPreview(false); }
              else { save(note); setPreview(true); }
            }}
            className="h-7 text-xs"
          >
            {preview ? <><Pencil className="w-3 h-3 mr-1" /> Edit</> : 'Preview'}
          </Button>
        )}
      </div>
      <label className="text-xs font-semibold block mb-1 mt-2">Open note</label>
      {canEdit && !preview ? (
        <MentionInput
          value={note}
          onChange={setNote}
          onBlur={() => save(note)}
          placeholder="How are you opening this meeting?"
          variant="textarea"
          className="min-h-[80px] border-2"
        />
      ) : (
        <div className="min-h-[80px] p-3 rounded-md border bg-background/40 whitespace-pre-wrap text-sm">
          {note?.trim()
            ? <MentionText text={note} />
            : <span className="italic text-muted-foreground">Not yet shared.</span>}
        </div>
      )}
    </Card>
  );
}

function ActionItemRow({ item, onChanged }: { item: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(item.description ?? '');
  const [due, setDue] = useState<string>(item.due_date ?? '');

  useEffect(() => { setDesc(item.description ?? ''); setDue(item.due_date ?? ''); }, [item.description, item.due_date]);

  const dueDate = parseLocalDate(item.due_date);
  const overdue = item.status !== 'done' && dueDate ? dueDate < new Date() : false;

  const saveField = async (patch: any) => {
    await supabase.from('table_action_items').update(patch).eq('id', item.id);
    onChanged();
  };

  const remove = async () => {
    if (!confirm('Delete this action item?')) return;
    await supabase.from('table_action_items').delete().eq('id', item.id);
    onChanged();
  };

  if (editing) {
    return (
      <div className="border-b last:border-0 py-2 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">{item.owner_name}</div>
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="text-sm min-h-[60px]"
        />
        <div className="flex items-center gap-2">
          <Input
            type="date" value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-8 text-xs w-[150px]"
          />
          <div className="flex-1" />
          <Button
            size="sm" variant="outline" className="h-8 text-xs"
            onClick={() => { setDesc(item.description ?? ''); setDue(item.due_date ?? ''); setEditing(false); }}
          >Cancel</Button>
          <Button
            size="sm" className="h-8 text-xs"
            onClick={async () => {
              await saveField({ description: desc, due_date: due || null });
              setEditing(false);
            }}
          >Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm border-b last:border-0 py-2">
      <div className="flex-1 min-w-0">
        <div className="font-medium">{item.owner_name}</div>
        <div className="text-muted-foreground whitespace-pre-wrap">{item.description}</div>
      </div>
      <div className={cn('text-xs whitespace-nowrap', overdue && 'text-danger font-semibold')}>
        {dueDate ? format(dueDate, 'MMM d') : ''}
      </div>
      <Select value={item.status} onValueChange={(v) => saveField({ status: v })}>
        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="done">Done</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditing(true)} aria-label="Edit">
        <Pencil className="w-3.5 h-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-danger" onClick={remove} aria-label="Delete">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function AddActionItemForm({ meetingId, createdBy, onAdded }: {
  meetingId: string; createdBy: string; onAdded: () => void;
}) {
  const { staff } = useActiveStaff();
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState<string>('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setOwnerId(''); setDesc(''); setDue(''); setOpen(false); };

  const submit = async () => {
    const ownerStaff = staff.find(s => s.id === ownerId);
    if (!ownerStaff) { toast.error('Pick an owner.'); return; }
    if (!desc.trim()) { toast.error('Add a description.'); return; }
    if (!due) { toast.error('Pick a due date.'); return; }
    setSaving(true);
    const { error } = await supabase.from('table_action_items').insert({
      meeting_id: meetingId,
      owner_staff_id: ownerStaff.id,
      owner_name: ownerStaff.name,
      description: desc.trim(),
      due_date: due,
      created_by: createdBy,
      status: 'open',
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Action item added');
    reset();
    onAdded();
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1" /> Add action item
      </Button>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-md border-2 border-brand/40 bg-background/40 space-y-2">
      <div className="font-semibold text-sm">New action item</div>
      <Select value={ownerId} onValueChange={setOwnerId}>
        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Owner" /></SelectTrigger>
        <SelectContent>
          {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="What needs to happen?"
        className="text-sm min-h-[60px]"
      />
      <div className="flex items-center gap-2">
        <Input
          type="date" value={due}
          onChange={(e) => setDue(e.target.value)}
          className="h-9 text-xs w-[160px]"
        />
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={reset} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button>
      </div>
    </div>
  );
}


// Collapsible "Your update — {lane}" card. Auto-collapses once locked in;
// chevron expands so the user can edit. Unlocked entries stay open.
function CollapsibleUpdateCard({ laneName, locked, children }: {
  laneName: string | null; locked: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!locked);
  // Re-collapse if it transitions to locked (e.g. just hit "Lock in").
  useEffect(() => { setOpen(!locked); }, [locked]);

  return (
    <Card className="p-4 mb-4 border-brand/40">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="font-semibold truncate">Your update — {laneName || 'Ownership role unassigned'}</div>
          {locked && <Badge className="bg-success text-[10px]">Locked in</Badge>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {locked && !open && <Pencil className="w-3.5 h-3.5 text-muted-foreground" />}
          <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
        </div>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </Card>
  );
}


// ───── Three-beat helpers ─────

function BeatHeader({ num, title, subtitle }: { num: 1 | 2 | 3; title: string; subtitle: string }) {
  return (
    <div className="mt-2 mb-3 flex items-baseline gap-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-brand">Beat {num}</div>
      <div>
        <div className="text-lg font-bold leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

// Beat 1 — Account. For each owner, show their LAST WEEK commitment with a
// kept/broken marker + result. Editable only for the current user's own lanes.
// Saves to the CURRENT week's table_owner_entries row (prior_status / prior_result)
// — never mutates the prior week's row.
function AccountBeat({
  owners, priorEntries, currentEntries, meetingId, myOwnerIds, onChanged,
}: {
  owners: TableOwner[];
  priorEntries: OwnerEntry[];
  currentEntries: OwnerEntry[];
  meetingId: string;
  myOwnerIds: string[];
  onChanged: () => void;
}) {
  const accountable = owners
    .map(o => ({
      owner: o,
      prior: priorEntries.find(e => e.owner_id === o.id),
      current: currentEntries.find(e => e.owner_id === o.id),
    }))
    .filter(r => (r.prior?.commitment ?? '').trim().length > 0);

  if (accountable.length === 0) {
    return (
      <Card className="p-4 mb-4 text-sm text-muted-foreground">
        No commitments from last week yet. They'll show up here next week.
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-4 space-y-3">
      {accountable.map(({ owner, prior, current }) => {
        const isMine = myOwnerIds.includes(owner.id);
        return (
          <AccountRow
            key={owner.id}
            owner={owner}
            priorCommitment={prior!.commitment ?? ''}
            status={current?.prior_status ?? null}
            result={current?.prior_result ?? ''}
            canEdit={isMine}
            meetingId={meetingId}
            ownerId={owner.id}
            onChanged={onChanged}
          />
        );
      })}
    </Card>
  );
}

function AccountRow({
  owner, priorCommitment, status, result, canEdit, meetingId, ownerId, onChanged,
}: {
  owner: TableOwner;
  priorCommitment: string;
  status: 'kept' | 'broken' | null;
  result: string;
  canEdit: boolean;
  meetingId: string;
  ownerId: string;
  onChanged: () => void;
}) {
  const [resultDraft, setResultDraft] = useState(result);
  const [showGrowth, setShowGrowth] = useState(false);
  useEffect(() => { setResultDraft(result); }, [result]);

  const saveStatus = async (next: 'kept' | 'broken') => {
    const { error } = await supabase
      .from('table_owner_entries')
      .upsert(
        { meeting_id: meetingId, owner_id: ownerId, prior_status: next, created_by: 'owner' },
        { onConflict: 'meeting_id,owner_id', ignoreDuplicates: false },
      );
    if (error) { toast.error(error.message); return; }
    onChanged();
  };

  const saveResult = async (val: string) => {
    if (val === result) return;
    const { error } = await supabase
      .from('table_owner_entries')
      .upsert(
        { meeting_id: meetingId, owner_id: ownerId, prior_result: val, created_by: 'owner' },
        { onConflict: 'meeting_id,owner_id', ignoreDuplicates: false },
      );
    if (error) { toast.error(error.message); return; }
    onChanged();
  };

  const statusBadge = status === 'kept'
    ? <Badge className="bg-success text-[10px]">Kept</Badge>
    : status === 'broken'
      ? <Badge className="bg-muted text-foreground text-[10px] border border-warning/60">Broken</Badge>
      : <Badge variant="outline" className="text-[10px]">Not marked yet</Badge>;

  return (
    <div className="border rounded-md p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="font-medium text-sm">{owner.display_name} · {owner.lane_name || '—'}</div>
        {statusBadge}
      </div>
      <div className="text-xs text-muted-foreground mb-1">Last week's commitment:</div>
      <div className="text-sm whitespace-pre-wrap mb-2"><MentionText text={priorCommitment} /></div>

      {canEdit ? (
        <>
          <div className="flex gap-2 mb-2">
            <Button
              size="sm"
              variant={status === 'kept' ? 'default' : 'outline'}
              className={status === 'kept' ? 'bg-success hover:bg-success/90' : ''}
              onClick={() => saveStatus('kept')}
            >
              <Check className="w-3 h-3 mr-1" /> Kept
            </Button>
            <Button
              size="sm"
              variant={status === 'broken' ? 'default' : 'outline'}
              onClick={() => saveStatus('broken')}
            >
              Broken
            </Button>
          </div>
          <label className="text-xs font-medium block mb-1">What happened?</label>
          <Textarea
            value={resultDraft}
            onChange={(e) => setResultDraft(e.target.value)}
            onBlur={() => saveResult(resultDraft)}
            placeholder="One or two lines is enough."
            className="text-sm min-h-[60px]"
          />
          {status === 'broken' && (
            <button
              type="button"
              onClick={() => setShowGrowth(v => !v)}
              className="text-[11px] text-brand underline mt-2"
            >
              {showGrowth ? 'Hide' : 'Growth process (optional)'}
            </button>
          )}
          {status === 'broken' && showGrowth && (
            <p className="text-[11px] text-muted-foreground mt-1">
              What got in the way? What would you do different next time? Put it in the result above — no shame, just clear eyes.
            </p>
          )}
        </>
      ) : (
        <>
          {result ? (
            <div className="text-xs text-muted-foreground italic whitespace-pre-wrap">Result: {result}</div>
          ) : (
            <div className="text-xs text-muted-foreground italic">Waiting on result…</div>
          )}
        </>
      )}
    </div>
  );
}
