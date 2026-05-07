import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface Props {
  vipMemberId: string | null;
  memberName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged?: () => void;
}

const TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'call', label: 'Call' },
  { value: 'in_person', label: 'In person' },
  { value: 'email', label: 'Email' },
  { value: 'class_visit', label: 'Class visit' },
];

export function LogTouchpointDialog({ vipMemberId, memberName, open, onOpenChange, onLogged }: Props) {
  const { user } = useAuth();
  const [type, setType] = useState('text');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!vipMemberId) return;
    setSaving(true);
    const { error } = await supabase.from('vip_touchpoints' as any).insert({
      vip_member_id: vipMemberId,
      staff_name: user?.name || 'Unknown',
      touchpoint_type: type,
      notes: notes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error('Could not log touchpoint'); return; }
    toast.success('Touchpoint logged');
    setNotes('');
    onLogged?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log touchpoint{memberName ? ` — ${memberName}` : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What happened?" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !vipMemberId} className="bg-[#E8540A] hover:bg-[#E8540A]/90">
            {saving ? 'Saving…' : 'Log it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
