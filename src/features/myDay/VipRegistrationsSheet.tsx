/**
 * Sheet showing all VIP session registrants with their full registration details
 * and per-attendee outcome logging.
 */
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Mail, Star, Save, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatPhoneDisplay } from '@/lib/parsing/phone';

interface Registration {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  weight_lbs: number | null;
  fitness_level: number | null;
  injuries: string | null;
  is_group_contact: boolean;
  created_at: string;
  outcome: string | null;
  outcome_notes: string | null;
  outcome_logged_at: string | null;
  outcome_logged_by: string | null;
}

const OUTCOME_OPTIONS = [
  { value: 'showed', label: 'Showed' },
  { value: 'no_show', label: 'No-Show' },
  { value: 'interested', label: 'Interested — follow up' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'booked_intro', label: 'Booked an Intro' },
  { value: 'purchased', label: 'Purchased Membership' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vipSessionId: string;
  vipGroupName: string | null;
  userName: string;
}

export default function VipRegistrationsSheet({ open, onOpenChange, vipSessionId, vipGroupName, userName }: Props) {
  const [loading, setLoading] = useState(false);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { outcome: string; notes: string }>>({});

  useEffect(() => {
    if (!open || !vipSessionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('vip_registrations' as any)
        .select('*')
        .eq('vip_session_id', vipSessionId)
        .order('is_group_contact', { ascending: false })
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error('Failed to load registrations');
        setRegs([]);
      } else {
        const list = (data as any as Registration[]) || [];
        setRegs(list);
        const initial: Record<string, { outcome: string; notes: string }> = {};
        for (const r of list) initial[r.id] = { outcome: r.outcome || '', notes: r.outcome_notes || '' };
        setDrafts(initial);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, vipSessionId]);

  const handleSave = async (regId: string) => {
    const draft = drafts[regId];
    if (!draft || !draft.outcome) {
      toast.error('Pick an outcome first');
      return;
    }
    setSavingId(regId);
    try {
      const { error } = await supabase
        .from('vip_registrations' as any)
        .update({
          outcome: draft.outcome,
          outcome_notes: draft.notes || null,
          outcome_logged_at: new Date().toISOString(),
          outcome_logged_by: userName,
        })
        .eq('id', regId);
      if (error) throw error;
      setRegs(prev => prev.map(r => r.id === regId ? {
        ...r,
        outcome: draft.outcome,
        outcome_notes: draft.notes || null,
        outcome_logged_at: new Date().toISOString(),
        outcome_logged_by: userName,
      } : r));
      toast.success('Outcome saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save outcome');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{vipGroupName || 'VIP Group'} — Registrants</SheetTitle>
          <SheetDescription>
            {regs.length} registered. Log an outcome for each attendee.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!loading && regs.length === 0 && (
            <div className="text-sm text-muted-foreground">No registrations yet.</div>
          )}
          {!loading && regs.map(r => {
            const fullName = `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Unnamed';
            const draft = drafts[r.id] || { outcome: '', notes: '' };
            const isLogged = !!r.outcome;
            return (
              <div key={r.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{fullName}</span>
                      {r.is_group_contact && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500 text-white border-transparent gap-0.5">
                          <Star className="w-2.5 h-2.5" /> Group Contact
                        </Badge>
                      )}
                      {isLogged && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-600 text-white border-transparent gap-0.5">
                          <Check className="w-2.5 h-2.5" /> {OUTCOME_OPTIONS.find(o => o.value === r.outcome)?.label || r.outcome}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {r.phone && formatPhoneDisplay(r.phone) && (
                    <a
                      href={`sms:+1${(r.phone || '').replace(/\D/g, '').replace(/^1/, '').slice(-10)}`}
                      className="flex items-center gap-1 text-primary underline min-h-[28px]"
                    >
                      <Phone className="w-3 h-3" /> {formatPhoneDisplay(r.phone)}
                    </a>
                  )}
                  {r.email && (
                    <a href={`mailto:${r.email}`} className="flex items-center gap-1 text-primary underline truncate min-h-[28px]">
                      <Mail className="w-3 h-3" /> <span className="truncate">{r.email}</span>
                    </a>
                  )}
                  {r.birthday && (
                    <div><span className="text-muted-foreground">DOB: </span>{r.birthday}</div>
                  )}
                  {r.weight_lbs != null && (
                    <div><span className="text-muted-foreground">Weight: </span>{r.weight_lbs} lbs</div>
                  )}
                  {r.fitness_level != null && (
                    <div><span className="text-muted-foreground">Fitness: </span>{r.fitness_level}/10</div>
                  )}
                </div>
                {r.injuries && (
                  <div className="text-xs"><span className="text-muted-foreground">Injuries/Notes: </span>{r.injuries}</div>
                )}

                <div className="pt-2 border-t space-y-2">
                  <div className="flex gap-2 items-center">
                    <Select
                      value={draft.outcome}
                      onValueChange={(v) => setDrafts(prev => ({ ...prev, [r.id]: { ...draft, outcome: v } }))}
                    >
                      <SelectTrigger className="h-9 text-xs flex-1">
                        <SelectValue placeholder="Select outcome…" />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTCOME_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-9 gap-1 text-xs"
                      onClick={() => handleSave(r.id)}
                      disabled={savingId === r.id}
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingId === r.id ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Notes (optional)"
                    value={draft.notes}
                    onChange={(e) => setDrafts(prev => ({ ...prev, [r.id]: { ...draft, notes: e.target.value } }))}
                    className="text-xs min-h-[60px]"
                  />
                  {r.outcome_logged_by && r.outcome_logged_at && (
                    <div className="text-[10px] text-muted-foreground">
                      Logged by {r.outcome_logged_by} · {new Date(r.outcome_logged_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
