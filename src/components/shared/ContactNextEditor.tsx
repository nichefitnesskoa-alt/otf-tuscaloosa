/**
 * Inline editable "Contact next" date for follow-up cards.
 * Shows computed default when reschedule_contact_date is null.
 * Saves to intros_booked.reschedule_contact_date on edit.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContactNextEditorProps {
  bookingId: string;
  contactNextDate: string | null;
  rescheduleContactDate: string | null;
  onSaved: () => void;
}

export function ContactNextEditor({ bookingId, contactNextDate, rescheduleContactDate, onSaved }: ContactNextEditorProps) {
  const [open, setOpen] = useState(false);
  
  const displayDate = contactNextDate || rescheduleContactDate;
  if (!displayDate) return null;

  const dateObj = (() => {
    const [y, m, d] = displayDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  })();

  const handleSelect = async (d: Date | undefined) => {
    if (!d) return;
    const ymd = format(d, 'yyyy-MM-dd');
    setOpen(false);
    const { error } = await supabase.from('intros_booked').update({
      reschedule_contact_date: ymd,
      last_edited_at: new Date().toISOString(),
    } as any).eq('id', bookingId);
    if (error) toast.error('Failed to save date');
    else { toast.success('Contact date updated'); onSaved(); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
          <CalendarIcon className="w-3 h-3" />
          <span>Contact next: {format(dateObj, 'MMM d')}</span>
          <Pencil className="w-2.5 h-2.5 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={dateObj} onSelect={handleSelect} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}
