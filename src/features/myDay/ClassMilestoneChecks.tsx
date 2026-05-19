/**
 * ClassMilestoneChecks — Today-only list of class times. SAs check off
 * once they've reviewed milestones for that class. Cannot check until
 * class start time has passed (people walk in last-minute). Window closes
 * 4 hours after start to force live check-offs. Add Celebration writes to
 * the same `milestones` table that feeds WIG.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Check, PartyPopper, Lock, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getTodayClassTimes,
  getChicagoTodayYMD,
  getChicagoMinutesNow,
  hhmmToMinutes,
  formatClassTimeDisplay,
} from '@/lib/classSchedule';

const WINDOW_MINUTES = 4 * 60; // 4 hours after class start
const UNDO_MINUTES = 30;

interface CheckRow {
  id: string;
  class_date: string;
  class_time: string; // "HH:mm:ss"
  checked_by: string;
  checked_at: string;
  unchecked_at: string | null;
}

type RowState = 'upcoming' | 'available' | 'checked' | 'missed';

export function ClassMilestoneChecks() {
  const { user } = useAuth();
  const today = useChicagoToday();
  const nowDate = useNowMinute();
  const minutesNow = nowDate.getHours() * 60 + nowDate.getMinutes();
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const classTimes = useMemo(() => getTodayClassTimes(), [today]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('class_milestone_checks')
      .select('*')
      .eq('class_date', today);
    setChecks((data as any) || []);
  }, [today]);

  useEffect(() => { load(); }, [load]);


  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('class-milestone-checks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_milestone_checks' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const checkByTime = useMemo(() => {
    const m = new Map<string, CheckRow>();
    for (const c of checks) {
      // normalize "HH:mm:ss" -> "HH:mm"
      const key = c.class_time.slice(0, 5);
      if (!c.unchecked_at) m.set(key, c);
    }
    return m;
  }, [checks]);

  const stateFor = (hhmm: string): RowState => {
    if (checkByTime.has(hhmm)) return 'checked';
    const start = hhmmToMinutes(hhmm);
    if (minutesNow < start) return 'upcoming';
    if (minutesNow > start + WINDOW_MINUTES) return 'missed';
    return 'available';
  };

  const counts = useMemo(() => {
    const c = { checked: 0, available: 0, upcoming: 0, missed: 0 };
    for (const t of classTimes) c[stateFor(t)]++;
    return c;
  }, [classTimes, checkByTime, minutesNow]);

  const handleCheck = async (hhmm: string) => {
    if (!user?.name) return;
    setBusy(hhmm);
    const { error } = await supabase
      .from('class_milestone_checks')
      .insert({ class_date: today, class_time: `${hhmm}:00`, checked_by: user.name } as any);
    setBusy(null);
    if (error) { toast.error('Could not save check'); return; }
    toast.success('Milestones checked');
    load();
  };

  const handleUndo = async (row: CheckRow) => {
    if (!user?.name) return;
    setBusy(row.class_time.slice(0, 5));
    const { error } = await supabase
      .from('class_milestone_checks')
      .delete()
      .eq('id', row.id);
    setBusy(null);
    if (error) { toast.error('Could not undo'); return; }
    load();
  };

  if (classTimes.length === 0) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
          <span>Today's Milestone Checks</span>
          <span className="text-xs font-normal text-muted-foreground">
            <span className="text-primary font-semibold">{counts.checked}</span> checked ·{' '}
            <span className="text-primary font-semibold">{counts.available}</span> available now ·{' '}
            <span>{counts.upcoming}</span> upcoming
            {counts.missed > 0 && <> · <span className="text-destructive">{counts.missed} missed</span></>}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground italic mt-1">If it didn't happen, mark it. We can only fix what's real.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {classTimes.map((hhmm, idx) => {
          const state = stateFor(hhmm);
          const row = checkByTime.get(hhmm);
          const display = formatClassTimeDisplay(hhmm);
          const start = hhmmToMinutes(hhmm);
          const minsToStart = start - minutesNow;
          const checkedAtMin = row ? Math.floor((Date.now() - new Date(row.checked_at).getTime()) / 60000) : 0;
          const canUndo = row && checkedAtMin <= UNDO_MINUTES;

          return (
            <div
              key={`${hhmm}-${idx}`}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md border p-3 min-h-[56px]',
                state === 'checked' && 'border-success/50 bg-success/10',
                state === 'available' && 'border-primary/40',
                state === 'upcoming' && 'border-border bg-muted/30',
                state === 'missed' && 'border-border bg-muted/20 opacity-70',
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  'px-2.5 py-1 rounded text-sm font-semibold whitespace-nowrap',
                  state === 'checked' && 'bg-success/20 text-success',
                  state === 'available' && 'bg-primary/15 text-primary',
                  state === 'upcoming' && 'bg-muted text-muted-foreground',
                  state === 'missed' && 'bg-muted text-muted-foreground',
                )}>
                  {display}
                </div>
                <div className="text-xs text-muted-foreground min-w-0 truncate">
                  {state === 'checked' && row && (
                    <>✓ Checked by {row.checked_by} at {new Date(row.checked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
                  )}
                  {state === 'available' && 'Available now'}
                  {state === 'upcoming' && (
                    <>Starts in {minsToStart >= 60 ? `${Math.floor(minsToStart / 60)}h ${minsToStart % 60}m` : `${minsToStart}m`}</>
                  )}
                  {state === 'missed' && 'Missed window'}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <AddCelebrationButton classTimeDisplay={display} createdBy={user?.name || ''} onSaved={() => {}} />
                {state === 'checked' ? (
                  canUndo ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUndo(row!)}
                      disabled={busy === hhmm}
                      className="h-9 px-2 text-muted-foreground"
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Undo
                    </Button>
                  ) : (
                    <span className="inline-flex items-center text-success text-xs font-medium px-2">
                      <Check className="h-4 w-4 mr-1" /> Done
                    </span>
                  )
                ) : state === 'available' ? (
                  <Button
                    size="sm"
                    onClick={() => handleCheck(hhmm)}
                    disabled={busy === hhmm}
                    className="h-9 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Check className="h-4 w-4 mr-1" /> Mark checked
                  </Button>
                ) : state === 'upcoming' ? (
                  <Button
                    size="sm"
                    disabled
                    variant="outline"
                    className="h-9 min-h-[44px] bg-primary/10 text-primary/60 border-primary/20"
                  >
                    <Lock className="h-4 w-4 mr-1" /> Locked
                  </Button>
                ) : (
                  <Button size="sm" disabled variant="outline" className="h-9">
                    <Clock className="h-4 w-4 mr-1" /> Closed
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ───────── Add Celebration dialog (writes to milestones, feeds WIG) ───────── */

function AddCelebrationButton({
  classTimeDisplay,
  createdBy,
  onSaved,
}: { classTimeDisplay: string; createdBy: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [pack, setPack] = useState(false);
  const [celebrated, setCelebrated] = useState(true);
  const [friendName, setFriendName] = useState('');
  const [friendContact, setFriendContact] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(''); setType(''); setPack(false); setCelebrated(true);
    setFriendName(''); setFriendContact('');
  };

  const save = async () => {
    if (!name.trim() || !type.trim() || !createdBy) {
      toast.error('Member name and milestone type required');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from('milestones')
      .insert({
        entry_type: 'milestone',
        member_name: name.trim(),
        milestone_type: type.trim(),
        five_class_pack_gifted: pack,
        actually_celebrated: celebrated,
        friend_name: friendName.trim() || null,
        friend_contact: friendContact.trim() || null,
        created_by: createdBy,
      } as any)
      .select('id')
      .single();

    // If a friend was added with contact, also create a lead in the pipeline
    if (!error && friendName.trim() && friendContact.trim() && data) {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(friendContact.trim());
      const parts = friendName.trim().split(/\s+/);
      const { data: lead } = await supabase
        .from('leads')
        .insert({
          first_name: parts[0] || friendName,
          last_name: parts.slice(1).join(' ') || '',
          phone: isEmail ? '' : friendContact.trim(),
          email: isEmail ? friendContact.trim() : null,
          source: 'Member Referral (5 class pack)',
          stage: 'new',
          duplicate_notes: `Referred via milestone — ${name.trim()}`,
        } as any)
        .select('id')
        .single();
      if (lead) {
        await supabase.from('milestones').update({ converted_to_lead_id: (lead as any).id } as any).eq('id', (data as any).id);
      }
    }

    setSaving(false);
    if (error) { toast.error('Could not save celebration'); return; }
    toast.success('Celebration logged — added to WIG');
    reset();
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-9 min-h-[44px] border-primary/40 text-primary hover:bg-primary/10">
          <PartyPopper className="h-4 w-4 mr-1" /> Add celebration
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log celebration · {classTimeDisplay}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="cel-name">Member name</Label>
            <Input id="cel-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cel-type">Milestone type</Label>
            <Input id="cel-type" value={type} onChange={(e) => setType(e.target.value)} placeholder="25th class · Birthday · etc." />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="cel-celebrated" className="text-sm">Actually celebrated in studio</Label>
            <Switch id="cel-celebrated" checked={celebrated} onCheckedChange={setCelebrated} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="cel-pack" className="text-sm">5-class pack gifted</Label>
            <Switch id="cel-pack" checked={pack} onCheckedChange={setPack} />
          </div>
          {pack && (
            <div className="space-y-3 rounded-md border border-primary/30 p-3 bg-primary/5">
              <div className="space-y-1.5">
                <Label htmlFor="cel-friend">Friend name</Label>
                <Input id="cel-friend" value={friendName} onChange={(e) => setFriendName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cel-contact">Friend phone or email</Label>
                <Input id="cel-contact" value={friendContact} onChange={(e) => setFriendContact(e.target.value)} />
              </div>
            </div>
          )}
          <Button onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {saving ? 'Saving…' : 'Save celebration'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
