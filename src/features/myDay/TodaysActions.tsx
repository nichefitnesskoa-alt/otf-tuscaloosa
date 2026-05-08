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

const toneClass: Record<ActionChip['tone'], string> = {
  primary: 'bg-[#E8540A]/10 border-[#E8540A]/40 text-[#E8540A] hover:bg-[#E8540A]/20',
  amber: 'bg-amber-500/10 border-amber-500/40 text-amber-700 hover:bg-amber-500/20',
  green: 'bg-green-500/10 border-green-500/40 text-green-700 hover:bg-green-500/20',
};

export function TodaysActions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'Admin';
  const isCoach = user?.role === 'Coach';
  const { staff } = useActiveStaff();

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
    <Card className="p-3 border-[#E8540A]/30">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#E8540A]" /> Today's Actions
        </h2>
        {isAdmin && (
          <Select value={adminPerson} onValueChange={setAdminPerson}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
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
        <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>
      ) : (
        <div className="space-y-1.5">
          {chips.map(c => (
            <button
              key={c.id}
              onClick={() => onChipTap(c)}
              className={`w-full text-left px-3 min-h-[44px] py-2 rounded-md border text-[13px] font-medium flex items-center justify-between ${toneClass[c.tone]}`}
            >
              <span>{c.label}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ))}
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
            <Button onClick={saveReferral} disabled={saving} className="bg-[#E8540A] hover:bg-[#E8540A]/90">
              {saving ? 'Saving…' : 'Mark asked'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
