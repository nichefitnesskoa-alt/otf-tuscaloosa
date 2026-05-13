import { useState, useMemo, useEffect } from 'react';
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
import {
  useCurrentMeeting, useActiveOwners, useArchitect, useOwnerEntries, useResponses, useActionItems,
  useOpenCarryForward, useCurrentWeekWins, useTableClose, useLaneHealth, useTableRealtime,
  nextMondayCT,
  type OwnerEntry, type TableOwner, type TableResponse, type TableActionItem,
} from '@/hooks/useTheTable';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { ManageOwnersDialog } from '@/components/table/ManageOwnersDialog';
import { MentionInput } from '@/components/shared/MentionInput';
import { MentionText } from '@/components/shared/MentionText';
import { OwnItMentionsCard } from '@/components/shared/OwnItMentionsCard';
import { ExportTeamMeetingButton } from '@/components/table/ExportTeamMeetingButton';
import { LANE_SUGGESTIONS } from '@/lib/table/laneSuggestions';
import { useRecentLaneCompleteness } from '@/lib/table/laneCompletion';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate, useParams } from 'react-router-dom';

const HEALTH_DOT: Record<string, string> = {
  green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500',
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
  const isAdmin = user?.role === 'Admin';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { meetingId: paramMeetingId } = useParams<{ meetingId?: string }>();

  const currentMonday = nextMondayCT();
  const [weekDate, setWeekDate] = useState<string>(currentMonday);

  const { data: meeting, isLoading } = useCurrentMeeting({ meetingId: paramMeetingId, weekDate });
  const { data: owners = [] } = useActiveOwners();
  const { data: architect } = useArchitect();
  const { data: entries = [] } = useOwnerEntries(meeting?.id);
  const { data: responses = [] } = useResponses(meeting?.id);
  const { data: actions = [] } = useActionItems(meeting?.id);
  const { data: carryForward = [] } = useOpenCarryForward(meeting?.id);
  const { data: wins = [] } = useCurrentWeekWins(meeting?.meeting_date);
  const { data: closeRow } = useTableClose(meeting?.id);
  const laneHealth = useLaneHealth(meeting?.id, meeting?.meeting_date);
  useTableRealtime(meeting?.id);

  const [manageOpen, setManageOpen] = useState(false);
  const [winOpen, setWinOpen] = useState(false);
  const [winText, setWinText] = useState('');
  const [actionDialog, setActionDialog] = useState<{ responseId: string; defaultDesc: string } | null>(null);

  // Self owner records (one row per lane). Architect doesn't appear here, so Koa never has any.
  const myOwners = owners.filter(o => o.display_name === user?.name);
  const myEntries = entries.filter(e => myOwners.some(o => o.id === e.owner_id));
  const allMySubmitted = myOwners.length > 0 && myOwners.every(o => myEntries.find(e => e.owner_id === o.id)?.submitted_at);
  const isArchitectViewer = !!architect && architect.display_name === user?.name;
  const architectEntry = architect && entries.find(e => e.owner_id === architect.id);

  // Default owner_id for "Log a win" composer when user holds 2+ lanes
  const [winOwnerId, setWinOwnerId] = useState<string | null>(null);
  const effectiveWinOwnerId = winOwnerId ?? myOwners[0]?.id ?? null;

  // Refresh helper
  const refresh = (key: string) => qc.invalidateQueries({ queryKey: [key, meeting?.id] });

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
            <Flag className="w-6 h-6 text-[#E8540A]" /> Own It
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
              <button onClick={goToToday} className="ml-2 text-[#E8540A] underline text-xs">Today</button>
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
    <Card className="p-4 mb-4 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20">
      <div className="font-semibold mb-2 text-sm">Open from prior weeks ({carryForward.length})</div>
      <div className="space-y-1">
        {carryForward.slice(0, 6).map(a => {
          const overdue = new Date(a.due_date) < new Date();
          return (
            <div key={a.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1">
              <div className="flex-1 truncate">
                <span className="font-medium">{a.owner_name}:</span> {a.description}
              </div>
              <div className={cn('text-xs', overdue && 'text-red-600 font-semibold')}>
                {format(new Date(a.due_date + 'T12:00:00'), 'MMM d')}
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
      <Trophy className="w-4 h-4 mr-1 text-amber-500" /> Log a win this week
    </Button>
  );

  // ---------- Pre-meeting view ----------
  const preMeetingView = (
    <>
      {/* Studio Leader — Architect (separate from Owner grid) */}
      {architect && (
        <Card className="p-4 mb-4 border-2 border-[#E8540A]/60 bg-[#E8540A]/5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#E8540A] font-bold">Studio Leader — Architect</div>
              <div className="text-lg font-bold">{architect.display_name}</div>
            </div>
          </div>
          <label className="text-xs font-semibold block mb-1 mt-2">Open note</label>
          {isArchitectViewer ? (
            <Textarea
              defaultValue={meeting.koa_open_note ?? ''}
              placeholder="How are you opening this meeting?"
              onBlur={async (e) => {
                await supabase.from('table_meetings').update({ koa_open_note: e.target.value }).eq('id', meeting.id);
                qc.invalidateQueries({ queryKey: ['table-meeting'] });
              }}
              className="min-h-[80px]"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{meeting.koa_open_note || <span className="italic text-muted-foreground">Not yet shared.</span>}</p>
          )}
        </Card>
      )}

      {/* Self-serve lanes manager — any staff member can claim/change/add their lanes */}
      {!isArchitectViewer && (
        <MyLanesManager myOwners={myOwners} onChanged={() => qc.invalidateQueries({ queryKey: ['table-owners'] })} />
      )}

      {/* Owner self-entry — one collapsible card per lane the user owns */}
      {myOwners.map(mine => {
        const myEntry = entries.find(e => e.owner_id === mine.id);
        return (
          <CollapsibleUpdateCard
            key={mine.id}
            laneName={mine.lane_name}
            locked={!!myEntry?.submitted_at}
          >
            <p className="text-xs text-muted-foreground mb-3">Say the thing you'd normally soften.</p>
            <OwnerEntryForm
              meetingId={meeting.id}
              ownerId={mine.id}
              entry={myEntry}
              onChange={() => refresh('table-entries')}
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
                    className={e?.submitted_at ? 'bg-emerald-600 text-[10px]' : 'text-amber-600 border-amber-600 text-[10px]'}
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

  // ---------- Live meeting view (stacked, everyone visible) ----------
  const submittedOwners = owners.filter(o => entries.some(e => e.owner_id === o.id && e.submitted_at));

  const liveView = submittedOwners.length === 0 ? (
    <Card className="p-8 text-center text-muted-foreground">No Owners have locked in updates yet.</Card>
  ) : (
    <>
      <Card className="p-4 mb-4 bg-muted/40">
        <div className="text-sm font-semibold mb-3">How to respond</div>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <Badge className="bg-emerald-600 shrink-0">Build</Badge>
            <div><span className="font-semibold">Add to the idea.</span> Stack your thinking on top of theirs — new angle, missing context, or a way to make it stronger.</div>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-red-600 shrink-0">Flag</Badge>
            <div><span className="font-semibold">Name a risk.</span> Say what could go wrong, what's missing, or what concerns you. Surface it now so we can fix it.</div>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-[#E8540A] shrink-0">Offer</Badge>
            <div><span className="font-semibold">Commit to do something.</span> Volunteer a specific action you'll take. Ends up as an Action Item with your name on it.</div>
          </div>
        </div>
      </Card>

      {submittedOwners.map(o => {
        const entry = entries.find(e => e.owner_id === o.id);
        if (!entry) return null;
        const ownerResponses = responses.filter(r => r.owner_entry_id === entry.id);
        return (
          <OwnerLiveCard
            key={o.id}
            owner={o}
            entry={entry}
            ownerResponses={ownerResponses}
            actions={actions}
            isAdmin={isAdmin}
            currentUserName={user?.name ?? null}
            allOwners={owners}
            meetingId={meeting.id}
            onOpenAction={(rid, desc) => setActionDialog({ responseId: rid, defaultDesc: desc })}
          />
        );
      })}
    </>
  );

  // ---------- Complete view ----------
  const completeView = (
    <>
      <Card className="p-4 mb-4">
        <div className="font-semibold mb-2">Action items ({actions.length})</div>
        {actions.length === 0 && <div className="text-sm text-muted-foreground">No action items.</div>}
        <div className="space-y-1">
          {actions.map(a => {
            const overdue = a.status !== 'done' && new Date(a.due_date) < new Date();
            return (
              <div key={a.id} className="flex items-center justify-between gap-2 text-sm border-b last:border-0 py-2">
                <div className="flex-1">
                  <div className="font-medium">{a.owner_name}</div>
                  <div className="text-muted-foreground">{a.description}</div>
                </div>
                <div className={cn('text-xs', overdue && 'text-red-600 font-semibold')}>
                  {format(new Date(a.due_date + 'T12:00:00'), 'MMM d')}
                </div>
                <Select value={a.status} onValueChange={async (v) => {
                  await supabase.from('table_action_items').update({ status: v }).eq('id', a.id);
                  refresh('table-actions');
                }}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
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

      {isAdmin && <KoaCloseSection meetingId={meeting.id} closeRow={closeRow} wins={wins} onChange={() => refresh('table-close')} />}
    </>
  );

  return (
    <div className="p-4 max-w-4xl mx-auto pb-24">
      {header}
      <OwnItMentionsCard variant="banner" />
      {carryBlock}
      <div className="mb-3 flex justify-between items-center">
        {winButton}
        <div className="text-xs text-muted-foreground">{wins.length} wins this week</div>
      </div>

      {/* Same layout for past / current / future — answers always visible on the page. */}
      {preMeetingView}
      {submittedOwners.length > 0 && (
        <div className="mt-6">
          <div className="text-xs uppercase font-semibold text-muted-foreground mb-2">Live discussion</div>
          {liveView}
        </div>
      )}
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
          <Textarea value={winText} onChange={(e) => setWinText(e.target.value)} placeholder="Big or small — log it." className="min-h-[100px]" />
          <Button className="bg-[#E8540A] hover:bg-[#E8540A]/90" onClick={async () => {
            if (!winText.trim() || !user?.name) return;
            await supabase.from('table_wins').insert({
              owner_id: effectiveWinOwnerId, owner_name: user.name,
              content: winText.trim(), meeting_week: meeting.meeting_date, created_by: user.name,
            });
            setWinText(''); setWinOpen(false); refresh('table-wins'); toast.success('Win logged');
          }}>Log win</Button>
        </DialogContent>
      </Dialog>

      {/* Action item from offer */}
      {actionDialog && (
        <ActionItemDialog
          meetingId={meeting.id}
          responseId={actionDialog.responseId}
          defaultDesc={actionDialog.defaultDesc}
          onClose={() => { setActionDialog(null); refresh('table-actions'); }}
        />
      )}
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
      <Card className="p-4 mb-4 border-2 border-dashed border-[#E8540A]/40">
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
                <Button className="mt-2 bg-[#E8540A] hover:bg-[#E8540A]/90" onClick={confirmAddLane} disabled={!pickerLane.trim() || saving}>
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
            <Button className="bg-[#E8540A] hover:bg-[#E8540A]/90" onClick={() => { setPendingThirdConfirm(false); setCommitOpen(true); }}>
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
              <Button className="bg-[#E8540A] hover:bg-[#E8540A]/90" onClick={() => setPicking(true)}>Add the lane</Button>
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
              <Button className="w-full bg-[#E8540A] hover:bg-[#E8540A]/90" onClick={confirmAddLane} disabled={!pickerLane.trim() || saving}>
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
  return (
    <div className="space-y-1 text-xs">
      {entry.last_week_update && <div><b>Last week:</b> {entry.last_week_update}</div>}
      {entry.this_week_focus && <div><b>This week:</b> {entry.this_week_focus}</div>}
      {entry.ideas && <div><b>Ideas:</b> {entry.ideas}</div>}
      {entry.ask && <div><b>Ask:</b> {entry.ask}</div>}
    </div>
  );
}

function OwnerEntryForm({ meetingId, ownerId, entry, onChange }: {
  meetingId: string; ownerId: string; entry?: OwnerEntry; onChange: () => void;
}) {
  const [savedField, setSavedField] = useState<string | null>(null);
  const locked = !!entry?.submitted_at;

  const save = async (field: keyof OwnerEntry, value: string) => {
    if (entry) {
      await supabase.from('table_owner_entries').update({ [field]: value }).eq('id', entry.id);
    } else {
      await supabase.from('table_owner_entries').insert({
        meeting_id: meetingId, owner_id: ownerId, [field]: value, created_by: 'owner',
      });
    }
    setSavedField(field as string);
    setTimeout(() => setSavedField(null), 2000);
    onChange();
  };

  const fields: { key: keyof OwnerEntry; label: string }[] = [
    { key: 'last_week_update', label: 'What happened in your lane last week?' },
    { key: 'this_week_focus', label: 'What are you focused on this week?' },
    { key: 'ideas', label: 'Any ideas on your mind?' },
    { key: 'ask', label: 'What do you need from someone in this room?' },
  ];

  return (
    <div className="space-y-3">
      {fields.map(f => {
        const val = (entry?.[f.key] as string) || '';
        const filled = val.trim().length > 0;
        return (
          <div key={f.key}>
            <label className="text-xs font-medium block mb-1">{f.label}</label>
            <Textarea
              defaultValue={val}
              disabled={locked}
              className={cn(
                'min-h-[70px] border-2',
                filled ? 'border-emerald-500/40' : 'border-amber-500/40',
              )}
              onBlur={(e) => e.target.value !== val && save(f.key, e.target.value)}
            />
            {savedField === f.key && <span className="text-xs text-emerald-600">Saved</span>}
          </div>
        );
      })}
      {!locked && (
        <Button
          className="w-full bg-[#E8540A] hover:bg-[#E8540A]/90"
          onClick={async () => {
            if (!entry) { toast.error('Fill at least one field first.'); return; }
            await supabase.from('table_owner_entries').update({ submitted_at: new Date().toISOString() }).eq('id', entry.id);
            onChange(); toast.success('Locked in.');
          }}
        >
          <Check className="w-4 h-4 mr-1" /> Lock in my update
        </Button>
      )}
    </div>
  );
}

function ActionItemDialog({ meetingId, responseId, defaultDesc, onClose }: {
  meetingId: string; responseId: string; defaultDesc: string; onClose: () => void;
}) {
  const { staff } = useActiveStaff();
  const [staffId, setStaffId] = useState('');
  const [desc, setDesc] = useState(defaultDesc);
  const [due, setDue] = useState(() => format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Turn into action item</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger><SelectValue placeholder="Assign to…" /></SelectTrigger>
            <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Button className="w-full bg-[#E8540A] hover:bg-[#E8540A]/90" onClick={async () => {
            const owner = staff.find(s => s.id === staffId);
            if (!owner) return;
            await supabase.from('table_action_items').insert({
              meeting_id: meetingId, source_response_id: responseId,
              owner_staff_id: owner.id, owner_name: owner.name,
              description: desc, due_date: due, status: 'open', created_by: 'admin',
            });
            toast.success('Action item created');
            onClose();
          }}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KoaCloseSection({ meetingId, closeRow, wins, onChange }: {
  meetingId: string; closeRow: any; wins: any[]; onChange: () => void;
}) {
  const [note, setNote] = useState(closeRow?.koa_close_note ?? '');
  const [word, setWord] = useState(closeRow?.energy_word ?? '');
  const selected: string[] = closeRow?.wins_selected ?? [];

  useEffect(() => {
    setNote(closeRow?.koa_close_note ?? '');
    setWord(closeRow?.energy_word ?? '');
  }, [closeRow]);

  const upsert = async (patch: any) => {
    if (closeRow) {
      await supabase.from('table_closes').update(patch).eq('id', closeRow.id);
    } else {
      await supabase.from('table_closes').insert({ meeting_id: meetingId, ...patch, created_by: 'admin' });
    }
    onChange();
  };

  const toggleWin = (id: string) => {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    upsert({ wins_selected: next });
    supabase.from('table_wins').update({ included_in_close: !selected.includes(id) }).eq('id', id);
  };

  return (
    <Card className="p-4 mb-4 border-2 border-[#E8540A]/60 bg-[#E8540A]/5">
      <div className="text-[11px] uppercase tracking-wider text-[#E8540A] font-bold mb-1">Studio Leader Close</div>
      <div className="font-semibold mb-3">Architect's wrap</div>
      <Textarea
        value={note} onChange={(e) => setNote(e.target.value)}
        onBlur={() => upsert({ koa_close_note: note })}
        placeholder="How are you closing this meeting?" className="min-h-[80px] mb-3"
      />
      <Input
        value={word} onChange={(e) => setWord(e.target.value)}
        onBlur={() => upsert({ energy_word: word })}
        placeholder="Energy word" maxLength={40} className="mb-3"
      />
      <div className="font-semibold text-sm mb-2 mt-4">Wins this week ({wins.length})</div>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {wins.map(w => {
          const on = selected.includes(w.id);
          return (
            <button key={w.id} onClick={() => toggleWin(w.id)}
              className={cn('w-full text-left border rounded-md p-2 text-sm transition-colors', on && 'border-amber-500 bg-amber-50 dark:bg-amber-950/30')}>
              <div className="font-medium">{w.owner_name}</div>
              <div className="text-muted-foreground">{w.content}</div>
            </button>
          );
        })}
        {wins.length === 0 && <div className="text-sm text-muted-foreground italic">No wins logged this week.</div>}
      </div>
    </Card>
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
    <Card className="p-4 mb-4 border-[#E8540A]/40">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="font-semibold truncate">Your update — {laneName || 'Ownership role unassigned'}</div>
          {locked && <Badge className="bg-emerald-600 text-[10px]">Locked in</Badge>}
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

// One stacked card per submitted owner during live discussion. Anyone can
// post a Build / Flag / Offer to any owner's feed — no carousel.
function OwnerLiveCard({
  owner, entry, ownerResponses, actions, isAdmin, currentUserName, allOwners, meetingId, onOpenAction,
}: {
  owner: TableOwner;
  entry: OwnerEntry;
  ownerResponses: TableResponse[];
  actions: TableActionItem[];
  isAdmin: boolean;
  currentUserName: string | null;
  allOwners: TableOwner[];
  meetingId: string;
  onOpenAction: (responseId: string, defaultDesc: string) => void;
}) {
  const [mode, setMode] = useState<'build' | 'flag' | 'offer' | null>(null);
  const [text, setText] = useState('');

  const submit = async () => {
    if (!mode || !text.trim() || !currentUserName) return;
    const me = allOwners.find(o => o.display_name === currentUserName);
    const { error } = await supabase.from('table_responses').insert({
      meeting_id: meetingId,
      owner_entry_id: entry.id,
      responder_staff_id: me?.staff_id ?? null,
      responder_name: currentUserName,
      mode,
      content: text.trim(),
      created_by: currentUserName,
    });
    if (error) { toast.error(error.message); return; }
    setText(''); setMode(null);
  };

  return (
    <Card className="p-4 mb-4">
      <div className="mb-3">
        <div className="text-xl font-bold">{owner.display_name}</div>
        <div className="text-sm text-muted-foreground">{owner.lane_name || 'Ownership role unassigned'}</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
        <EntryField label="Last week" value={entry.last_week_update} />
        <EntryField label="This week" value={entry.this_week_focus} />
        <EntryField label="Ideas" value={entry.ideas} />
        <EntryField label="Ask of the room" value={entry.ask} />
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setMode('build')}>Build</Button>
        <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => setMode('flag')}>Flag</Button>
        <Button size="sm" className="bg-[#E8540A] hover:bg-[#E8540A]/90" onClick={() => setMode('offer')}>Offer</Button>
      </div>
      {mode && (
        <div className="mb-3 flex gap-2">
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Add a ${mode}…`}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <Button onClick={submit}>Add</Button>
          <Button variant="ghost" onClick={() => { setMode(null); setText(''); }}>Cancel</Button>
        </div>
      )}
      <div className="space-y-2">
        {ownerResponses.map(r => {
          const linkedAction = actions.find(a => a.source_response_id === r.id);
          return (
            <div key={r.id} className="border rounded-md p-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge className={cn(
                  r.mode === 'build' && 'bg-emerald-600',
                  r.mode === 'flag' && 'bg-red-600',
                  r.mode === 'offer' && 'bg-[#E8540A]',
                )}>{r.mode}</Badge>
                <span className="font-medium">{r.responder_name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{format(new Date(r.created_at), 'p')}</span>
              </div>
              <div className="text-sm mt-1">{r.content}</div>
              {r.mode === 'offer' && !linkedAction && isAdmin && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => onOpenAction(r.id, r.content)}>
                  <Plus className="w-3 h-3 mr-1" /> Turn this into an action item
                </Button>
              )}
              {linkedAction && (
                <div className="mt-2 text-xs bg-muted p-2 rounded">
                  Action: {linkedAction.owner_name} · due {format(new Date(linkedAction.due_date + 'T12:00:00'), 'MMM d')} · {linkedAction.status}
                </div>
              )}
            </div>
          );
        })}
        {ownerResponses.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-3">No responses yet. Build, Flag, or Offer.</div>
        )}
      </div>
    </Card>
  );
}
