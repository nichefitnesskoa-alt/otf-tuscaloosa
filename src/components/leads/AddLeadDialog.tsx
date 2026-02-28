import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { formatPhoneAsYouType, autoCapitalizeName } from '@/components/shared/FormHelpers';

const LEAD_SOURCE_OPTIONS = [
  'Manual Entry',
  'Instagram DM',
  'Cold Lead Re-engagement',
  'Member Referral',
  'Event',
  'Walk-in',
] as const;

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadAdded: () => void;
}

export function AddLeadDialog({ open, onOpenChange, onLeadAdded }: AddLeadDialogProps) {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('Manual Entry');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setSource('Manual Entry');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      toast.error('First name, last name, and phone are required');
      return;
    }
    setSaving(true);
    try {
      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          source,
          stage: 'new',
        })
        .select('id')
        .single();

      if (error) throw error;

      // Log initial note if provided
      if (notes.trim() && lead) {
        await supabase.from('lead_activities').insert({
          lead_id: lead.id,
          activity_type: 'note',
          performed_by: user?.name || 'Unknown',
          notes: notes.trim(),
        });
      }

      toast.success('Lead added');
      reset();
      onOpenChange(false);
      onLeadAdded();
    } catch (err) {
      toast.error('Failed to add lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name *</Label>
              <Input value={firstName} onChange={e => setFirstName(autoCapitalizeName(e.target.value))} placeholder="First" />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input value={lastName} onChange={e => setLastName(autoCapitalizeName(e.target.value))} placeholder="Last" />
            </div>
          </div>
          <div>
            <Label>Phone *</Label>
            <Input value={phone} onChange={e => setPhone(formatPhoneAsYouType(e.target.value))} placeholder="(555) 123-4567" type="tel" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" type="email" />
          </div>
          <div>
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_SOURCE_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any initial notes..." rows={2} />
          </div>
          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? 'Adding...' : 'Add Lead'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
