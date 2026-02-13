import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface LogPastContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName: string;
  bookingId: string | null;
  leadId: string | null;
  onDone: () => void;
}

const METHODS = [
  { value: 'call', label: '📞 Phone Call' },
  { value: 'text', label: '💬 Text Message' },
  { value: 'email', label: '📧 Email' },
  { value: 'in_person', label: '🤝 In Person' },
  { value: 'dm', label: '📱 DM / Social' },
] as const;

export function LogPastContactDialog({
  open,
  onOpenChange,
  personName,
  bookingId,
  leadId,
  onDone,
}: LogPastContactDialogProps) {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [method, setMethod] = useState<string>('text');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!date) {
      toast.error('Please select a date');
      return;
    }
    setSaving(true);
    try {
      // Log a backdated script_action so guardrails respect it
      await supabase.from('script_actions').insert({
        action_type: `past_${method}`,
        completed_by: user?.name || 'Unknown',
        completed_at: date.toISOString(),
        booking_id: bookingId || null,
        lead_id: leadId || null,
        script_category: 'past_contact',
      });

      // Update the follow_up_queue: mark touch 1 as sent with backdated timestamp
      if (bookingId || leadId) {
        const query = supabase
          .from('follow_up_queue')
          .update({
            status: 'sent',
            sent_by: user?.name || 'Unknown',
            sent_at: date.toISOString(),
          })
          .eq('status', 'pending')
          .eq('person_name', personName)
          .eq('touch_number', 1);

        await query;
      }

      toast.success(`Past contact logged for ${personName}`);
      setDate(undefined);
      setMethod('text');
      setNotes('');
      onOpenChange(false);
      onDone();
    } catch {
      toast.error('Failed to log past contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Log Past Contact — {personName}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Record when you last reached out so the follow-up cadence adjusts correctly.
          </p>
        </DialogHeader>
        <div className="space-y-4">
          {/* Date Picker */}
          <div className="space-y-1.5">
            <Label className="text-sm">When did you contact them? *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d > new Date() || d < subDays(new Date(), 90)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Method Picker */}
          <div className="space-y-1.5">
            <Label className="text-sm">Contact method</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {METHODS.map((m) => (
                <Button
                  key={m.value}
                  type="button"
                  variant={method === m.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs justify-start"
                  onClick={() => setMethod(m.value)}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Left voicemail, they said they'd come next week..."
              rows={2}
              className="text-sm"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={saving || !date}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Log Past Contact'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
