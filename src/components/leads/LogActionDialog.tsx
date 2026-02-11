import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface LogActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadStage: string;
  actionType: 'call' | 'text' | 'note';
  onDone: () => void;
}

const TITLES: Record<string, string> = {
  call: 'Log Call',
  text: 'Log Text',
  note: 'Add Notes',
};

export function LogActionDialog({ open, onOpenChange, leadId, leadStage, actionType, onDone }: LogActionDialogProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: actionType,
        performed_by: user?.name || 'Unknown',
        notes: notes.trim() || null,
      });

      // Auto-advance from new to contacted
      if ((actionType === 'call' || actionType === 'text') && leadStage === 'new') {
        await supabase.from('leads').update({ stage: 'contacted' }).eq('id', leadId);
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          activity_type: 'stage_change',
          performed_by: 'System',
          notes: 'Auto-moved from New to Contacted',
        });
      }

      toast.success(`${TITLES[actionType]} logged`);
      setNotes('');
      onOpenChange(false);
      onDone();
    } catch {
      toast.error('Failed to log action');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLES[actionType]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Notes {actionType === 'note' ? '*' : '(optional)'}</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={actionType === 'call' ? 'Left voicemail, spoke with them...' : actionType === 'text' ? 'Sent intro text...' : 'Add your notes...'}
              rows={3}
            />
          </div>
          <Button onClick={handleSubmit} disabled={saving || (actionType === 'note' && !notes.trim())} className="w-full">
            {saving ? 'Saving...' : `Log ${TITLES[actionType]}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
