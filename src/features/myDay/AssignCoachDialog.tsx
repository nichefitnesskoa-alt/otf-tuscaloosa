import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NameAutocomplete } from '@/components/shared/NameAutocomplete';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { Check, Loader2 } from 'lucide-react';

interface TbdBooking {
  id: string;
  member_name?: string | null;
  class_date?: string | null;
  intro_time?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookings: TbdBooking[];
  editedBy: string;
  onSaved: () => void;
}

function fmtDate(s?: string | null) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'EEE, MMM d');
}

export function AssignCoachDialog({ open, onOpenChange, bookings, editedBy, onSaved }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const setCoach = (id: string, v: string) => setDrafts(p => ({ ...p, [id]: v }));

  const saveOne = async (id: string) => {
    const coach = (drafts[id] || '').trim();
    if (!coach) {
      toast.error('Pick a coach first');
      return;
    }
    setSavingId(id);
    try {
      const { error } = await supabase
        .from('intros_booked')
        .update({
          coach_name: coach,
          last_edited_at: new Date().toISOString(),
          last_edited_by: editedBy,
          edit_reason: 'Assigned coach from missing-coach banner',
        })
        .eq('id', id);
      if (error) throw error;
      setSavedIds(prev => new Set(prev).add(id));
      toast.success(`Coach assigned: ${coach}`);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to assign coach');
    } finally {
      setSavingId(null);
    }
  };

  const remaining = bookings.filter(b => !savedIds.has(b.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Assign Coach{bookings.length === 1 ? '' : `es (${remaining.length} left)`}
          </DialogTitle>
        </DialogHeader>

        {remaining.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Check className="w-5 h-5 text-emerald-500 inline mr-1" />
            All coaches assigned.
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {remaining.map(b => (
              <div key={b.id} className="border rounded-md p-3 space-y-2">
                <div className="text-sm font-semibold">{b.member_name || 'Intro'}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(b.class_date)}
                  {b.intro_time ? ` · ${formatDisplayTime(b.intro_time)}` : ''}
                </div>
                <div className="flex gap-2">
                  <NameAutocomplete
                    value={drafts[b.id] || ''}
                    onChange={v => setCoach(b.id, v)}
                    placeholder="Coach name"
                    className="h-11 flex-1"
                  />
                  <Button
                    onClick={() => saveOne(b.id)}
                    disabled={savingId === b.id || !(drafts[b.id] || '').trim()}
                    className="min-h-[44px] bg-[#E8540A] hover:bg-[#E8540A]/90 text-primary-foreground"
                  >
                    {savingId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
            {remaining.length === 0 ? 'Done' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
