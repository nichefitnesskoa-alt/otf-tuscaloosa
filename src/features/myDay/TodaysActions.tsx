import { isAdmin as isAdminCheck } from '@/lib/auth/roles';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useTodaysActions, type ActionChip } from './useTodaysActions';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useJourneyCard } from '@/components/person/useJourneyCard';

const toneClass: Record<ActionChip['tone'], string> = {
  primary: 'bg-brand-dim border-brand text-brand hover:bg-brand/20',
  amber: 'bg-warning-dim border-warning text-warning hover:bg-warning/20',
  green: 'bg-success-dim border-success text-success hover:bg-success/20',
};

export function TodaysActions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isAdminCheck(user);
  const isCoach = user?.role === 'Coach';
  const { staff } = useActiveStaff();
  const journey = useJourneyCard();

  const [adminPerson, setAdminPerson] = useState<string>(user?.name || '');
  const adminPersonRecord = staff.find(s => s.name === adminPerson);
  const adminPersonRole: 'Coach' | 'SA' | 'Admin' = (adminPersonRecord?.role as any) || 'SA';

  const effectiveName = isAdmin ? adminPerson : (user?.name || '');
  const effectiveRole = isAdmin ? adminPersonRole : ((user?.role as any) || 'SA');

  const { chips, refresh } = useTodaysActions(effectiveName || null, effectiveRole);

  // Referral ask dialog
  const [refTarget, setRefTarget] = useState<{ bookingId: string; memberName: string } | null>(null);
  const [refNames, setRefNames] = useState('');
  const [saving, setSaving] = useState(false);

  const onChipTap = (c: ActionChip) => {
    switch (c.kind) {
      case 'score':
        navigate(`/scorecards/me?bookingId=${c.meta.bookingId || ''}`);
        break;
      case 'follow_up_coach':
        navigate('/my-intros');
        break;
      case 'milestone':
        navigate('/wig?focus=milestones&member=' + encodeURIComponent(c.meta.memberName));
        break;
      case 'referral_ask':
        setRefTarget({ bookingId: c.meta.bookingId, memberName: c.meta.memberName });
        break;
      case 'cadence_eval':
        navigate('/scorecards/me');
        break;
    }
  };

  const saveReferral = async () => {
    if (!refTarget) return;
    setSaving(true);
    const { error } = await supabase.from('intros_booked').update({
      coach_referral_asked: true,
      coach_referral_names: refNames || null,
      last_edited_by: user?.name || 'Unknown',
      last_edited_at: new Date().toISOString(),
      edit_reason: 'Referral ask logged from My Day',
    } as any).eq('id', refTarget.bookingId);
    setSaving(false);
    if (error) { toast.error('Save failed'); return; }
    toast.success('Logged');
    setRefTarget(null); setRefNames('');
    refresh();
  };

  const emptyMessage = useMemo(() => {
    if (effectiveRole === 'Coach') return 'No actions today. Coach the room.';
    if (effectiveRole === 'SA') return 'No actions today. Make someone\'s day.';
    return 'All clear across the team.';
  }, [effectiveRole]);

  return (
    <Card className="p-3 border-brand">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5 text-text-primary">
          <Sparkles className="w-4 h-4 text-brand" /> Today's Actions
        </h2>
        {isAdmin && (
          <Select value={adminPerson} onValueChange={setAdminPerson}>
            <SelectTrigger className="h-8 w-[160px] text-xs bg-surface-card border-surface-border text-text-primary">
              <SelectValue placeholder="Pick a person" />
            </SelectTrigger>
            <SelectContent>
              {staff.map(s => (
                <SelectItem key={s.name} value={s.name} className="text-xs">{s.name} ({s.role})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {chips.length === 0 ? (
        <p className="text-xs text-text-secondary py-2">{emptyMessage}</p>
      ) : (
        <div className="space-y-1.5">
          {chips.map(c => {
            const memberName: string | undefined = c.meta?.memberName;
            const bookingId: string | undefined = c.meta?.bookingId;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onChipTap(c)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChipTap(c); } }}
                className={`w-full text-left px-3 min-h-[44px] py-2 rounded-md border text-[13px] font-medium flex items-center justify-between cursor-pointer ${toneClass[c.tone]}`}
              >
                <span className="min-w-0 flex-1">
                  {memberName ? (
                    <>
                      {c.label.split(memberName)[0]}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (bookingId) journey.openByBooking(bookingId);
                          else journey.open({ name: memberName });
                        }}
                        className="underline underline-offset-2 hover:opacity-80 cursor-pointer"
                      >
                        {memberName}
                      </button>
                      {c.label.split(memberName).slice(1).join(memberName)}
                    </>
                  ) : c.label}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 ml-2" />
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!refTarget} onOpenChange={o => !o && setRefTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Referral ask — {refTarget?.memberName}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Names mentioned (optional)</Label>
            <Input value={refNames} onChange={e => setRefNames(e.target.value)} placeholder="Who'd love this?" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRefTarget(null)}>Cancel</Button>
            <Button onClick={saveReferral} disabled={saving} className="bg-brand hover:bg-brand-hover text-brand-foreground">
              {saving ? 'Saving…' : 'Mark asked'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
