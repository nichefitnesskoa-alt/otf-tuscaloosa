/**
 * EventPicker — used inside any booking form when lead_source is one of the
 * "Event / Self Generated Lead" variants.
 *
 * Two modes:
 *   - Event (has a date): pick or create a dated event (existing behavior).
 *   - General outreach: pick or type a general outreach activity (no date).
 *
 * Both persist to the `events` table and communicate the selected event_id
 * up via onValueChange so the parent can store it on the booking insert.
 */
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/shared/FormHelpers';
import { Calendar as CalendarIcon, Megaphone, Plus, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useActiveEvents, useCreateEvent, formatEventDateLocal, type OutreachActivityType } from '@/hooks/useEvents';
import { useEventLookup } from '@/hooks/useEventLookup';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EventPickerProps {
  value: string | null;
  onValueChange: (eventId: string | null) => void;
  required?: boolean;
  /** Compact spacing for inline use inside dense forms. */
  dense?: boolean;
}

export function EventPicker({ value, onValueChange, required, dense }: EventPickerProps) {
  const [activityType, setActivityType] = useState<OutreachActivityType>('event');
  const [seededFromValue, setSeededFromValue] = useState(false);
  const eventLookup = useEventLookup();

  // Seed the activity type toggle from the persisted event's activity_type
  // so reopening a booking tagged to a "General outreach" activity shows the
  // right tab (and the tag stays visible instead of appearing empty).
  useEffect(() => {
    if (seededFromValue || !value) return;
    const entry = eventLookup.get(value);
    if (!entry) return;
    if (entry.activity_type && entry.activity_type !== activityType) {
      setActivityType(entry.activity_type as OutreachActivityType);
    }
    setSeededFromValue(true);
  }, [value, eventLookup, seededFromValue, activityType]);

  const { data: events = [], isLoading } = useActiveEvents(activityType);
  const createEvent = useCreateEvent();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleTypeSwitch = (t: OutreachActivityType) => {
    if (t === activityType) return;
    setActivityType(t);
    // Only clear the current selection if it belongs to the OTHER type —
    // switching tabs shouldn't silently wipe a valid, already-persisted tag.
    if (value) {
      const entry = eventLookup.get(value);
      if (!entry || entry.activity_type !== t) {
        onValueChange(null);
      }
    }
    setCreating(false);
    setNewName('');
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error(activityType === 'event' ? 'Event name required' : 'Outreach name required'); return; }
    if (activityType === 'event' && !newDate) { toast.error('Event date required'); return; }
    try {
      const row = await createEvent.mutateAsync({
        name: newName.trim(),
        event_date: activityType === 'event' ? newDate : null,
        activity_type: activityType,
      });
      onValueChange(row.id);
      setCreating(false);
      setNewName('');
      toast.success(`${activityType === 'event' ? 'Event' : 'Outreach'} "${row.name}" created and tagged`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create');
    }
  };

  const selected = events.find(e => e.id === value);
  const isEvent = activityType === 'event';

  return (
    <div className={`rounded-lg border border-primary/30 bg-primary/5 ${dense ? 'p-2.5' : 'p-3'} space-y-2`}>
      {/* Activity type toggle */}
      <div className="grid grid-cols-2 gap-1 rounded-md bg-background/60 p-1">
        <button
          type="button"
          onClick={() => handleTypeSwitch('event')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition',
            isEvent ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <CalendarIcon className="w-3.5 h-3.5" /> Event (has date)
        </button>
        <button
          type="button"
          onClick={() => handleTypeSwitch('general_outreach')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition',
            !isEvent ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <Megaphone className="w-3.5 h-3.5" /> General outreach
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        {isEvent ? <CalendarIcon className="w-4 h-4 text-primary" /> : <Megaphone className="w-4 h-4 text-primary" />}
        {isEvent ? 'Which event?' : 'Which outreach activity?'} {required && <span className="text-destructive">*</span>}
      </div>

      {!creating && (
        <div className="space-y-2">
          <Select value={value || ''} onValueChange={v => onValueChange(v || null)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={isLoading ? 'Loading…' : isEvent ? 'Select an event…' : 'Select outreach…'} />
            </SelectTrigger>
            <SelectContent>
              {events.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {isEvent ? 'No active events yet.' : 'No outreach activities yet.'}
                </div>
              )}
              {events.map(e => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}{isEvent && e.event_date ? ` — ${formatEventDateLocal(e.event_date)}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected && (
            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tagged to <strong>{selected.name}</strong>
              {isEvent && selected.event_date ? ` · ${formatEventDateLocal(selected.event_date)}` : ''}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-9 border-primary text-primary hover:bg-primary/10"
            onClick={() => setCreating(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            {isEvent ? 'Create new event' : 'Create new outreach activity'}
          </Button>
        </div>
      )}

      {creating && (
        <div className="space-y-2 rounded-md border border-dashed border-primary/40 p-2.5 bg-background/50">
          <div className="space-y-1">
            <Label className="text-xs">{isEvent ? 'Event name *' : 'Outreach name *'}</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={isEvent ? 'e.g. Turbo Coffee tabling' : 'e.g. Cold gym floor asks'}
              className="h-9"
              autoFocus
            />
          </div>
          {isEvent && (
            <div className="space-y-1">
              <Label className="text-xs">Event date *</Label>
              <DatePickerField value={newDate} onChange={setNewDate} />
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={handleCreate}
              disabled={createEvent.isPending}
            >
              {createEvent.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Save {isEvent ? 'event' : 'outreach'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setCreating(false); setNewName(''); }}
            >
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          </div>
          {isEvent && (
            <p className="text-[10px] text-muted-foreground leading-tight">
              Cost gets added later in the events admin — no need to know it right now.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
