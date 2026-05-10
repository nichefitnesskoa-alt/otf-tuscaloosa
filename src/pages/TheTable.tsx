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
import { Flag, Plus, ChevronLeft, ChevronRight, Settings, History, Trophy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  useCurrentMeeting, useActiveOwners, useOwnerEntries, useResponses, useActionItems,
  useOpenCarryForward, useCurrentWeekWins, useTableClose, useLaneHealth, useTableRealtime,
  type OwnerEntry, type TableOwner,
} from '@/hooks/useTheTable';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { ManageOwnersDialog } from '@/components/table/ManageOwnersDialog';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

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

export default function TheTable() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: meeting, isLoading } = useCurrentMeeting();
  const { data: owners = [] } = useActiveOwners();
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
  const [activeOwnerIdx, setActiveOwnerIdx] = useState(0);
  const [responseMode, setResponseMode] = useState<'build' | 'flag' | 'offer' | null>(null);
  const [responseText, setResponseText] = useState('');
  const [actionDialog, setActionDialog] = useState<{ responseId: string; defaultDesc: string } | null>(null);

  // Self owner record, if any
  const myOwner = owners.find(o => o.display_name === user?.name);
  const myEntry = myOwner && entries.find(e => e.owner_id === myOwner.id);

  // Refresh helper
  const refresh = (key: string) => qc.invalidateQueries({ queryKey: [key, meeting?.id] });

  if (isLoading || !meeting) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  // ---------- Header ----------
  const header = (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flag className="w-6 h-6 text-[#E8540A]" /> Own It
        </h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(meeting.meeting_date + 'T12:00:00'), 'EEEE, MMM d')} · {formatMeetingTime(meeting.meeting_time)}
          {' · '}
          <Badge variant={meeting.status === 'live' ? 'default' : 'secondary'} className="ml-1">{meeting.status}</Badge>
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate('/the-table/history')}>
          <History className="w-4 h-4 mr-1" /> Past Meetings
        </Button>
        {isAdmin && (
          <>
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              <Settings className="w-4 h-4 mr-1" /> Manage Owners
            </Button>
            <Select value={meeting.status} onValueChange={async (v) => {
              await supabase.from('table_meetings').update({ status: v }).eq('id', meeting.id);
              qc.invalidateQueries({ queryKey: ['table-meeting'] });
              toast.success(`Marked ${v}`);
            }}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    </div>
  );

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
      {/* Koa's Open */}
      {(isAdmin || meeting.koa_open_note) && (
        <Card className="p-4 mb-4">
          <label className="text-sm font-semibold block mb-1">Koa's Open</label>
          {isAdmin ? (
            <Textarea
              defaultValue={meeting.koa_open_note ?? ''}
              placeholder="How are you opening The Table this week?"
              onBlur={async (e) => {
                await supabase.from('table_meetings').update({ koa_open_note: e.target.value }).eq('id', meeting.id);
                qc.invalidateQueries({ queryKey: ['table-meeting'] });
              }}
              className="min-h-[80px]"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{meeting.koa_open_note}</p>
          )}
        </Card>
      )}

      {/* Owner self-entry */}
      {myOwner && (
        <Card className="p-4 mb-4 border-[#E8540A]/40">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Your update — {myOwner.lane_name || 'Lane unassigned'}</div>
            {myEntry?.submitted_at && <Badge className="bg-emerald-600">Locked in</Badge>}
          </div>
          <OwnerEntryForm
            meetingId={meeting.id}
            ownerId={myOwner.id}
            entry={myEntry}
            onChange={() => refresh('table-entries')}
          />
        </Card>
      )}

      {/* Owner dashboard */}
      <Card className="p-4 mb-4">
        <div className="font-semibold mb-3">Owners ({owners.length})</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {owners.map(o => {
            const e = entries.find(en => en.owner_id === o.id);
            const submitted = !!e?.submitted_at;
            const health = laneHealth[o.id];
            return (
              <div key={o.id} className="flex items-center gap-3 border rounded-md p-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn('w-3 h-3 rounded-full shrink-0', HEALTH_DOT[health?.status ?? 'red'])} />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-1">
                      <div>{health?.submittedOnTime ? '✓' : '✗'} Submitted on time</div>
                      <div>{health?.receivedResponse ? '✓' : '✗'} Got a response</div>
                      <div>{health?.actionItemProgressed ? '✓' : '✗'} Action moved forward</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{o.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.lane_name || 'Lane unassigned'}</div>
                </div>
                <Badge variant={submitted ? 'default' : 'outline'} className={submitted ? 'bg-emerald-600' : 'text-amber-600 border-amber-600'}>
                  {submitted ? 'Locked in' : 'Not yet'}
                </Badge>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Peer entries (visible after I've submitted) */}
      {myEntry?.submitted_at && (
        <Card className="p-4 mb-4">
          <div className="font-semibold mb-3">What other Owners brought</div>
          <div className="space-y-3">
            {owners.filter(o => o.id !== myOwner?.id).map(o => {
              const e = entries.find(en => en.owner_id === o.id);
              return (
                <div key={o.id} className="border rounded-md p-3">
                  <div className="font-medium text-sm mb-1">{o.display_name} · {o.lane_name || '—'}</div>
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
      )}
    </>
  );

  // ---------- Live meeting view ----------
  const submittedOwners = owners.filter(o => entries.some(e => e.owner_id === o.id && e.submitted_at));
  const activeOwner = submittedOwners[activeOwnerIdx];
  const activeEntry = activeOwner ? entries.find(e => e.owner_id === activeOwner.id) : null;
  const activeResponses = activeEntry ? responses.filter(r => r.owner_entry_id === activeEntry.id) : [];

  const submitResponse = async () => {
    if (!responseMode || !responseText.trim() || !activeEntry || !user?.name) return;
    const me = owners.find(o => o.display_name === user.name);
    const { error } = await supabase.from('table_responses').insert({
      meeting_id: meeting.id, owner_entry_id: activeEntry.id,
      responder_staff_id: me?.staff_id ?? null, responder_name: user.name,
      mode: responseMode, content: responseText.trim(), created_by: user.name,
    });
    if (error) { toast.error(error.message); return; }
    setResponseText(''); setResponseMode(null);
  };

  const liveView = activeOwner && activeEntry ? (
    <>
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setActiveOwnerIdx(i => Math.max(0, i - 1))} disabled={activeOwnerIdx === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold">{activeOwner.display_name}</div>
            <div className="text-sm text-muted-foreground">{activeOwner.lane_name || 'Lane unassigned'}</div>
            <div className="text-xs text-muted-foreground mt-1">{activeOwnerIdx + 1} of {submittedOwners.length}</div>
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setActiveOwnerIdx(i => Math.min(submittedOwners.length - 1, i + 1))} disabled={activeOwnerIdx >= submittedOwners.length - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <EntryField label="Last week" value={activeEntry.last_week_update} />
          <EntryField label="This week" value={activeEntry.this_week_focus} />
          <EntryField label="Ideas" value={activeEntry.ideas} />
          <EntryField label="Ask of the room" value={activeEntry.ask} />
        </div>
      </Card>

      {/* Response feed */}
      <Card className="p-4 mb-4">
        <div className="flex gap-2 mb-3">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setResponseMode('build')}>
            Build
          </Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => setResponseMode('flag')}>
            Flag
          </Button>
          <Button size="sm" className="bg-[#E8540A] hover:bg-[#E8540A]/90" onClick={() => setResponseMode('offer')}>
            Offer
          </Button>
        </div>
        {responseMode && (
          <div className="mb-3 flex gap-2">
            <Input
              autoFocus
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder={`Add a ${responseMode}…`}
              onKeyDown={(e) => e.key === 'Enter' && submitResponse()}
            />
            <Button onClick={submitResponse}>Add</Button>
            <Button variant="ghost" onClick={() => { setResponseMode(null); setResponseText(''); }}>Cancel</Button>
          </div>
        )}
        <div className="space-y-2">
          {activeResponses.map(r => {
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
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setActionDialog({ responseId: r.id, defaultDesc: r.content })}>
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
          {activeResponses.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No responses yet. Build, Flag, or Offer.</div>}
        </div>
      </Card>
    </>
  ) : (
    <Card className="p-8 text-center text-muted-foreground">No Owners have locked in updates yet.</Card>
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
      {carryBlock}
      <div className="mb-3 flex justify-between items-center">
        {winButton}
        <div className="text-xs text-muted-foreground">{wins.length} wins this week</div>
      </div>

      {meeting.status === 'upcoming' && preMeetingView}
      {meeting.status === 'live' && liveView}
      {meeting.status === 'complete' && completeView}

      <ManageOwnersDialog open={manageOpen} onOpenChange={setManageOpen} />

      {/* Win logger */}
      <Dialog open={winOpen} onOpenChange={setWinOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>What happened worth celebrating?</DialogTitle></DialogHeader>
          <Textarea value={winText} onChange={(e) => setWinText(e.target.value)} placeholder="Big or small — log it." className="min-h-[100px]" />
          <Button className="bg-[#E8540A] hover:bg-[#E8540A]/90" onClick={async () => {
            if (!winText.trim() || !user?.name) return;
            await supabase.from('table_wins').insert({
              owner_id: myOwner?.id ?? null, owner_name: user.name,
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
    <Card className="p-4 mb-4 border-[#E8540A]/40">
      <div className="font-semibold mb-3">Koa's Close</div>
      <Textarea
        value={note} onChange={(e) => setNote(e.target.value)}
        onBlur={() => upsert({ koa_close_note: note })}
        placeholder="How are you closing The Table?" className="min-h-[80px] mb-3"
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
