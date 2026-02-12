import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface MarkLostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onDone: () => void;
}

const REASONS = [
  { value: 'went_cold', label: 'Went cold' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'already_member', label: 'Already a member' },
  { value: 'other', label: 'Other' },
];

export function MarkLostDialog({ open, onOpenChange, leadId, onDone }: MarkLostDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await supabase.from('leads').update({
        stage: 'lost',
        lost_reason: reason || null,
      }).eq('id', leadId);

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown',
        notes: `Marked as lost${reason ? ': ' + REASONS.find(r => r.value === reason)?.label : ''}`,
      });

      toast.success('Lead marked as lost');
      setReason('');
      onOpenChange(false);
      onDone();
    } catch {
      toast.error('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Do Not Contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Reason (optional)</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} disabled={saving} variant="destructive" className="w-full">
            {saving ? 'Saving...' : 'Mark as Do Not Contact'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
