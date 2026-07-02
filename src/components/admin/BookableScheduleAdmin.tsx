/**
 * Admin: edit the public intro scheduler's weekly template + per-date overrides.
 *
 * - Weekly template: toggle each slot bookable/unbookable, remove a slot,
 *   or add a new slot to a specific day of the week.
 * - Per-date overrides: cancel a specific class on a specific date, or add
 *   an extra class not in the template.
 *
 * Internal `src/lib/classSchedule.ts` is NOT affected — this only controls
 * the public /book scheduler.
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/shared/FormHelpers';
import { useAuth } from '@/context/AuthContext';
import { formatClassTimeDisplay } from '@/lib/classSchedule';
import { Plus, Trash2, CalendarX, CalendarPlus, Loader2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function normalizeHhmm(t: string): string {
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

export function BookableScheduleAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const editor = user?.name || 'Admin';

  const slotsQ = useQuery({
    queryKey: ['intro_bookable_slots'],
    queryFn: async () => {
      const { data, error } = await supabase.from('intro_bookable_slots' as any)
        .select('*').order('day_of_week').order('slot_time');
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const overridesQ = useQuery({
    queryKey: ['intro_bookable_slot_overrides'],
    queryFn: async () => {
      const { data, error } = await supabase.from('intro_bookable_slot_overrides' as any)
        .select('*').order('class_date');
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const upd = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.from('intro_bookable_slots' as any)
        .update({ ...row, updated_by: editor }).eq('id', row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intro_bookable_slots'] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('intro_bookable_slots' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intro_bookable_slots'] }),
  });

  const addSlot = useMutation({
    mutationFn: async (payload: { day_of_week: number; slot_time: string; class_label: string; is_bookable: boolean }) => {
      const { error } = await supabase.from('intro_bookable_slots' as any).insert({
        ...payload,
        slot_time: normalizeHhmm(payload.slot_time),
        is_active: true,
        updated_by: editor,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intro_bookable_slots'] }),
  });

  const addOverride = useMutation({
    mutationFn: async (payload: { class_date: string; slot_time: string; action: 'cancel' | 'add'; note?: string }) => {
      const { error } = await supabase.from('intro_bookable_slot_overrides' as any).insert({
        ...payload,
        slot_time: normalizeHhmm(payload.slot_time),
        created_by: editor,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intro_bookable_slot_overrides'] }),
  });

  const delOverride = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('intro_bookable_slot_overrides' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intro_bookable_slot_overrides'] }),
  });

  const grouped = useMemo(() => {
    const g = new Map<number, any[]>();
    for (const s of slotsQ.data || []) {
      const arr = g.get(s.day_of_week) || [];
      arr.push(s);
      g.set(s.day_of_week, arr);
    }
    return g;
  }, [slotsQ.data]);

  // Add-slot mini form
  const [addOpen, setAddOpen] = useState<number | null>(null);
  const [addTime, setAddTime] = useState('06:15');
  const [addLabel, setAddLabel] = useState('2G');
  const [addBookable, setAddBookable] = useState(true);

  // Override form
  const [ovDate, setOvDate] = useState('');
  const [ovTime, setOvTime] = useState('05:00');
  const [ovAction, setOvAction] = useState<'cancel' | 'add'>('cancel');
  const [ovNote, setOvNote] = useState('');

  if (slotsQ.isLoading) return <div className="p-6 text-muted-foreground">Loading schedule…</div>;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Weekly template — public bookable slots</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Only <strong>bookable</strong> slots appear on the public /book page. Toggle a slot off (e.g. Strength/Tread 50)
          to hide it publicly without removing it. Changes apply to all future weeks.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6, 0].map(dow => {
            const rows = grouped.get(dow) || [];
            return (
              <div key={dow} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{DAY_NAMES[dow]}</div>
                  <Button size="sm" variant="ghost" onClick={() => setAddOpen(addOpen === dow ? null : dow)}>
                    <Plus className="w-4 h-4 mr-1" /> Add class
                  </Button>
                </div>
                {rows.length === 0 && <p className="text-xs text-muted-foreground">No classes.</p>}
                <div className="space-y-1.5">
                  {rows.map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <div className="w-20 font-mono">{formatClassTimeDisplay(r.slot_time.slice(0, 5))}</div>
                      <Input
                        value={r.class_label || ''}
                        onChange={e => upd.mutate({ ...r, class_label: e.target.value })}
                        className="h-8 flex-1"
                        placeholder="Label (e.g. 2G)"
                      />
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={r.is_bookable}
                          onCheckedChange={v => upd.mutate({ ...r, is_bookable: v })}
                        />
                        <span className="text-xs text-muted-foreground w-16">{r.is_bookable ? 'Bookable' : 'Hidden'}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {addOpen === dow && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <div className="flex gap-2">
                      <div>
                        <Label className="text-xs">Time (24h)</Label>
                        <Input value={addTime} onChange={e => setAddTime(e.target.value)} placeholder="06:15" className="h-9 w-24 font-mono" />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Label</Label>
                        <Input value={addLabel} onChange={e => setAddLabel(e.target.value)} className="h-9" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={addBookable} onCheckedChange={setAddBookable} />
                      <span className="text-xs">Publicly bookable</span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={async () => {
                        await addSlot.mutateAsync({ day_of_week: dow, slot_time: addTime, class_label: addLabel, is_bookable: addBookable });
                        toast.success('Class added');
                        setAddOpen(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarX className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Per-date overrides</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Cancel a specific class on a specific day (holiday, coach out) or add a one-off class.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end mb-4">
          <div>
            <Label className="text-xs">Date</Label>
            <DatePickerField value={ovDate} onChange={setOvDate} />
          </div>
          <div>
            <Label className="text-xs">Time (24h)</Label>
            <Input value={ovTime} onChange={e => setOvTime(e.target.value)} className="h-9 font-mono" />
          </div>
          <div>
            <Label className="text-xs">Action</Label>
            <Select value={ovAction} onValueChange={v => setOvAction(v as any)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cancel">Cancel this class</SelectItem>
                <SelectItem value="add">Add this class</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={async () => {
              if (!ovDate || !ovTime) { toast.error('Date and time required'); return; }
              await addOverride.mutateAsync({ class_date: ovDate, slot_time: ovTime, action: ovAction, note: ovNote || undefined });
              toast.success(ovAction === 'cancel' ? 'Class cancelled' : 'Class added');
              setOvDate(''); setOvNote('');
            }}
          >
            {ovAction === 'cancel' ? <><CalendarX className="w-4 h-4 mr-1" /> Cancel</> : <><CalendarPlus className="w-4 h-4 mr-1" /> Add</>}
          </Button>
        </div>

        <div className="space-y-1.5">
          {(overridesQ.data || []).length === 0 && <p className="text-sm text-muted-foreground">No overrides.</p>}
          {(overridesQ.data || []).map(o => (
            <div key={o.id} className="flex items-center gap-2 text-sm rounded-md border border-border p-2">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${o.action === 'cancel' ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'}`}>
                {o.action.toUpperCase()}
              </span>
              <span className="font-mono">{o.class_date}</span>
              <span className="font-mono">{formatClassTimeDisplay((o.slot_time as string).slice(0, 5))}</span>
              {o.note && <span className="text-muted-foreground text-xs">— {o.note}</span>}
              <Button size="sm" variant="ghost" onClick={() => delOverride.mutate(o.id)} className="ml-auto text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
