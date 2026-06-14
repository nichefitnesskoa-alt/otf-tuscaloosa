/**
 * EventPicker — used inside any booking form when lead_source === 'Event'.
 *
 * Lets the staffer either pick an active event or create one inline
 * (name + date — cost is set later in the events admin). The selected
 * event_id is communicated up via onValueChange so the parent can persist
 * it on the booking insert.
 */
import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerField } from '@/components/shared/FormHelpers';
import { Calendar as CalendarIcon, Plus, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useActiveEvents, useCreateEvent, formatEventDateLocal } from '@/hooks/useEvents';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface EventPickerProps {
  value: string | null;
  onValueChange: (eventId: string | null) => void;
  required?: boolean;
  /** Compact spacing for inline use inside dense forms. */
  dense?: boolean;
}

export function EventPicker({ value, onValueChange, required, dense }: EventPickerProps) {
  const { data: events = [], isLoading } = useActiveEvents();
  const createEvent = useCreateEvent();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Event name required'); return; }
    if (!newDate) { toast.error('Event date required'); return; }
    try {
      const row = await createEvent.mutateAsync({ name: newName.trim(), event_date: newDate });
      onValueChange(row.id);
      setCreating(false);
      setNewName('');
      toast.success(`Event "${row.name}" created and tagged`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create event');
    }
  };

  const selected = events.find(e => e.id === value);

  return (
    <div className={`rounded-lg border border-primary/30 bg-primary/5 ${dense ? 'p-2.5' : 'p-3'} space-y-2`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarIcon className="w-4 h-4 text-primary" />
        Which event? {required && <span className="text-destructive">*</span>}
      </div>

      {!creating && (
        <div className="space-y-2">
          <Select value={value || ''} onValueChange={v => onValueChange(v || null)}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={isLoading ? 'Loading events…' : 'Select an event…'} />
            </SelectTrigger>
            <SelectContent>
              {events.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No active events yet.</div>
              )}
              {events.map(e => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} — {formatEventDateLocal(e.event_date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected && (
            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Tagged to <strong>{selected.name}</strong> · {formatEventDateLocal(selected.event_date)}
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
            Create new event
          </Button>
        </div>
      )}

      {creating && (
        <div className="space-y-2 rounded-md border border-dashed border-primary/40 p-2.5 bg-background/50">
          <div className="space-y-1">
            <Label className="text-xs">Event name *</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Turbo Coffee tabling"
              className="h-9"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Event date *</Label>
            <DatePickerField value={newDate} onChange={setNewDate} />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={handleCreate}
              disabled={createEvent.isPending}
            >
              {createEvent.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Save event
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
          <p className="text-[10px] text-muted-foreground leading-tight">
            Cost gets added later in the events admin — no need to know it right now.
          </p>
        </div>
      )}
    </div>
  );
}
