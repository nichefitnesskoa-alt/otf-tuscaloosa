/**
 * Shared "Log SOML upgrade / referral" dialog.
 *
 * Writes to the SAME tables as the WIG SOML section's inline LogDialog
 * (`soml_upgrades`, `soml_manual_referrals`) with the SAME payload shape,
 * and fires `notifySomlChanged()` so the WIG scoreboard refetches.
 *
 * For referrals: `member_name` = the NEW person being referred;
 * `referring_member_name` = the existing member doing the referring.
 * On the Outreach list the row's person is the referring member, so we
 * pre-fill that side.
 */
import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { NameAutocomplete } from '@/components/shared/NameAutocomplete';
import { notifySomlChanged } from '@/hooks/useSomlData';

interface Props {
  open: boolean;
  onClose: () => void;
  kind: 'upgrade' | 'referral';
  /** For upgrade: the member who upgraded. For referral: the existing member doing the referring. */
  defaultMemberName?: string;
  onSaved?: () => void;
}

export function LogSomlDialog({ open, onClose, kind, defaultMemberName, onSaved }: Props) {
  const { user } = useAuth();
  // For upgrade: the member. For referral: the NEW person being referred.
  const [memberName, setMemberName] = useState('');
  // Referral only: the existing member doing the referring (defaults from prop).
  const [referringMember, setReferringMember] = useState('');
  const [notes, setNotes] = useState('');
  const [tier, setTier] = useState<'Premier' | 'Elite' | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (kind === 'upgrade') {
        setMemberName(defaultMemberName || '');
        setReferringMember('');
      } else {
        setMemberName('');
        setReferringMember(defaultMemberName || '');
      }
      setNotes('');
      setTier('');
    }
  }, [open, defaultMemberName, kind]);

  const submit = async () => {
    if (kind === 'upgrade') {
      if (!memberName.trim()) { toast.error('Member name is required'); return; }
      if (!tier) { toast.error('Pick what they upgraded to'); return; }
    } else {
      if (!referringMember.trim()) { toast.error('Who is doing the referring?'); return; }
      if (!memberName.trim()) { toast.error('Who did they refer?'); return; }
    }
    if (!user?.name) { toast.error('Login required'); return; }
    setSaving(true);
    const table = kind === 'upgrade' ? 'soml_upgrades' : 'soml_manual_referrals';
    const payload: any = kind === 'upgrade'
      ? { member_name: memberName.trim(), upgraded_by: user.name, upgraded_to_tier: tier, notes: notes.trim() || null, created_by: user.name }
      : {
          member_name: memberName.trim(),
          referring_member_name: referringMember.trim(),
          referred_by: user.name,
          notes: notes.trim() || null,
          created_by: user.name,
        };
    const { error } = await (supabase as any).from(table).insert(payload);
    setSaving(false);
    if (error) { toast.error(`Save failed: ${error.message}`); return; }
    toast.success(kind === 'upgrade' ? 'Upgrade logged to SOML' : 'Referral logged to SOML');
    notifySomlChanged();
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{kind === 'upgrade' ? 'Log an upgrade (SOML)' : 'Log a referral (SOML)'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {kind === 'upgrade' ? (
            <>
              <div>
                <Label className="text-xs">Member name *</Label>
                <NameAutocomplete value={memberName} onChange={setMemberName} placeholder="Who upgraded?" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  We'll pull matches from your outreach lists first — you can also type a name in.
                </p>
              </div>
              <div>
                <Label className="text-xs">Upgraded to *</Label>
                <div className="flex gap-2 mt-1">
                  {(['Premier', 'Elite'] as const).map(t => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={tier === t ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setTier(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-xs">Referring member *</Label>
                <NameAutocomplete value={referringMember} onChange={setReferringMember} placeholder="Existing member doing the referring" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  We'll pull matches from your outreach lists first — you can also type a name in.
                </p>
              </div>
              <div>
                <Label className="text-xs">Who did they refer? *</Label>
                <NameAutocomplete value={memberName} onChange={setMemberName} placeholder="New person's full name" />
              </div>
            </>
          )}
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Credited to <span className="font-semibold text-foreground">{user?.name || '—'}</span>.
            This posts to the SOML WIG scoreboard.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Log'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
