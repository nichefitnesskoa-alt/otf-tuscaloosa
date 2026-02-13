import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Phone, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InlinePhoneInputProps {
  /** Person's name to match across bookings */
  personName: string;
  /** Specific booking ID to update */
  bookingId?: string | null;
  /** Called after successful save */
  onSaved?: () => void;
  /** Compact variant for tight spaces */
  compact?: boolean;
}

export function InlinePhoneInput({ personName, bookingId, onSaved, compact }: InlinePhoneInputProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      // Update the linked booking
      if (bookingId) {
        await supabase.from('intros_booked').update({ phone: value.trim() }).eq('id', bookingId);
      }
      // Also update all bookings for this person that lack a phone
      await supabase.from('intros_booked')
        .update({ phone: value.trim() })
        .eq('member_name', personName)
        .is('phone', null);

      toast.success('Phone number saved');
      setEditing(false);
      setValue('');
      onSaved?.();
    } catch (err) {
      console.error('Save phone error:', err);
      toast.error('Failed to save phone number');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          type="tel"
          placeholder="(205) 555-1234"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={cn('flex-1', compact ? 'h-6 text-[11px]' : 'h-7 text-xs')}
          autoFocus
        />
        <Button
          size="sm"
          className={cn(compact ? 'h-6 text-[10px]' : 'h-7 text-[11px]', 'gap-1')}
          onClick={handleSave}
          disabled={saving || !value.trim()}
        >
          {saving ? '...' : 'Save'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={cn(compact ? 'h-6 px-1' : 'h-7 px-1.5', 'text-[11px]')}
          onClick={() => { setEditing(false); setValue(''); }}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className={cn(
        'w-full gap-1 border-destructive/30 text-destructive hover:bg-destructive/5',
        compact ? 'h-6 text-[10px]' : 'h-7 text-[11px]'
      )}
      onClick={() => { setEditing(true); setValue(''); }}
    >
      <Plus className="w-3 h-3" />
      Add Phone Number
    </Button>
  );
}

/** Badge to show when phone is missing */
export function NoPhoneBadge({ compact }: { compact?: boolean }) {
  return (
    <Badge className={cn(
      'border bg-destructive/15 text-destructive border-destructive/30',
      compact ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0 h-4'
    )}>
      <Phone className="w-2.5 h-2.5 mr-0.5" />
      No Phone
    </Badge>
  );
}
