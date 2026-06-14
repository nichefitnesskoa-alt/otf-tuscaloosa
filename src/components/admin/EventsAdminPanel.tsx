/**
 * EventsAdminPanel — manage the events list.
 *
 * Edit name / date, set or update COST (the $ paid at the event,
 * entered after the fact, e.g. $200 to Turbo Coffee), and toggle
 * active. Past/inactive events drop off the booking dropdown but
 * stay in history and cohort view.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CalendarDays, Plus, Loader2, DollarSign, Pencil, Check, X } from 'lucide-react';
import { DatePickerField } from '@/components/shared/FormHelpers';
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  formatEventDateLocal,
  centsToDollarsInput,
  dollarsInputToCents,
} from '@/hooks/useEvents';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface EditState {
  id: string;
  name: string;
  event_date: string;
  cost: string;
  is_active: boolean;
}

export function EventsAdminPanel() {
  const { data: events = [], isLoading } = useEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [editing, setEditing] = useState<EditState | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Name required'); return; }
    try {
      await createEvent.mutateAsync({ name: newName.trim(), event_date: newDate });
      toast.success('Event created');
      setNewName(''); setShowNew(false);
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  const startEdit = (e: any) => {
    setEditing({
      id: e.id,
      name: e.name,
      event_date: e.event_date,
      cost: centsToDollarsInput(e.cost_cents),
      is_active: e.is_active,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Name required'); return; }
    try {
      await updateEvent.mutateAsync({
        id: editing.id,
        name: editing.name.trim(),
        event_date: editing.event_date,
        cost_cents: dollarsInputToCents(editing.cost),
        is_active: editing.is_active,
      });
      toast.success('Event updated');
      setEditing(null);
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Events
          </CardTitle>
          {!showNew && (
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-1" /> New event
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Tabling events, partnerships, anything where you paid for someone's first intro. Add cost after the event so the cohort view can show it.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showNew && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Turbo Coffee tabling" autoFocus />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date *</Label>
                <DatePickerField value={newDate} onChange={setNewDate} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={createEvent.isPending}>
                {createEvent.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowNew(false); setNewName(''); }}>Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No events yet.</p>
        ) : (
          <div className="space-y-2">
            {events.map(e => {
              const isEditing = editing?.id === e.id;
              return (
                <div key={e.id} className="rounded-lg border p-3 space-y-2">
                  {!isEditing && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{e.name}</span>
                          {!e.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatEventDateLocal(e.event_date)}</span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {e.cost_cents != null ? `$${(e.cost_cents / 100).toFixed(2)}` : <span className="italic">no cost set</span>}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => startEdit(e)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                    </div>
                  )}

                  {isEditing && editing && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input value={editing.name} onChange={ev => setEditing({ ...editing, name: ev.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Date</Label>
                          <DatePickerField value={editing.event_date} onChange={v => setEditing({ ...editing, event_date: v })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cost (USD)</Label>
                          <div className="relative">
                            <DollarSign className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="pl-7"
                              value={editing.cost}
                              onChange={ev => setEditing({ ...editing, cost: ev.target.value })}
                              placeholder="e.g. 200.00"
                            />
                          </div>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <Label className="text-xs">Active (appears in booking dropdown)</Label>
                            <div className="h-10 flex items-center">
                              <Switch checked={editing.is_active} onCheckedChange={v => setEditing({ ...editing, is_active: v })} />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} disabled={updateEvent.isPending}>
                          {updateEvent.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          <X className="w-4 h-4 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
