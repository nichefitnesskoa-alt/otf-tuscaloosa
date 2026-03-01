import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { ClassTimeSelect } from '@/components/shared/FormHelpers';

interface ConvertVipToIntroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vipBooking: {
    id: string;
    member_name: string;
    phone?: string | null;
    email?: string | null;
    coach_name?: string | null;
    fitness_goal?: string | null;
  };
  onConverted: () => void;
}

export function ConvertVipToIntroDialog({
  open, onOpenChange, vipBooking, onConverted,
}: ConvertVipToIntroDialogProps) {
  const { user } = useAuth();
  const [classDate, setClassDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [introTime, setIntroTime] = useState('');
  const [coachName, setCoachName] = useState(vipBooking.coach_name || 'TBD');
  const [isSaving, setIsSaving] = useState(false);

  const handleConvert = async () => {
    if (!classDate) {
      toast.error('Please set a class date');
      return;
    }
    setIsSaving(true);
    try {
      const saName = user?.name || 'Unknown';

      // Create new real intro booking
      const { data: newBooking, error: insertErr } = await supabase
        .from('intros_booked')
        .insert({
          member_name: vipBooking.member_name,
          class_date: classDate,
          intro_time: introTime || null,
          coach_name: coachName || 'TBD',
          sa_working_shift: saName,
          lead_source: 'VIP Converted',
          booked_by: saName,
          phone: vipBooking.phone || null,
          email: vipBooking.email || null,
          fitness_goal: vipBooking.fitness_goal || null,
          is_vip: false,
          booking_status: 'Active',
          booking_status_canon: 'ACTIVE',
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;

      // Update original VIP booking
      await supabase
        .from('intros_booked')
        .update({
          vip_status: 'CONVERTED',
          converted_to_booking_id: newBooking.id,
          last_edited_at: new Date().toISOString(),
          last_edited_by: `${saName} (VIP Convert)`,
          edit_reason: 'Converted VIP to real intro booking',
        })
        .eq('id', vipBooking.id);

      toast.success(`${vipBooking.member_name} converted to real intro!`);
      onConverted();
      onOpenChange(false);
    } catch (err) {
      console.error('VIP conversion error:', err);
      toast.error('Failed to convert');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            Convert to Real Intro
          </DialogTitle>
          <DialogDescription>
            Create a normal intro booking for <strong>{vipBooking.member_name}</strong>. They will appear in MyDay and enter the standard sales funnel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Class Date *</Label>
            <Input type="date" value={classDate} onChange={e => setClassDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Intro Time (optional)</Label>
            <ClassTimeSelect value={introTime} onValueChange={setIntroTime} placeholder="Select time..." />
          </div>
          <div>
            <Label className="text-xs">Coach</Label>
            <Input value={coachName} onChange={e => setCoachName(e.target.value)} placeholder="TBD" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConvert} disabled={isSaving || !classDate}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Convert & Create Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
