import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Star, ArrowLeft, Cake, MessageSquare, Phone, Mail, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useVipsData, type VipMember, type VipTouchpoint } from './useVipsData';
import { LogTouchpointDialog } from './LogTouchpointDialog';

function Section({ title, children, defaultOpen = false, count }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{title}</h3>
              {count !== undefined && <Badge variant="secondary">{count}</Badge>}
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function VipProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCoach = user?.role === 'Coach';
  const { allMembers, touchpoints, registrations, bookings, runs, lifetimeVisitsFor, fetchAll } = useVipsData();
  const [logOpen, setLogOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const member: VipMember | undefined = useMemo(() => allMembers.find(m => m.id === id), [allMembers, id]);

  useEffect(() => { if (member) setNotesDraft(member.vip_notes || ''); }, [member?.id]);

  const memberTouches = useMemo(() => touchpoints.filter(t => t.vip_member_id === id), [touchpoints, id]);
  const memberRegs = useMemo(() => registrations.filter(r => r.vip_member_id === id), [registrations, id]);
  const memberBookingIds = new Set(memberRegs.map(r => r.booking_id).filter(Boolean));
  const memberBookings = bookings.filter(b => memberBookingIds.has(b.id));
  const fullName = member ? `${member.first_name} ${member.last_name || ''}`.trim() : '';

  const memberRuns = runs.filter(r => (r.member_name || '').toLowerCase() === fullName.toLowerCase());

  const saveNotes = async () => {
    if (!member || isCoach) return;
    const { error } = await supabase.from('vip_members' as any).update({ vip_notes: notesDraft } as any).eq('id', member.id);
    if (error) { toast.error('Save failed'); return; }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    fetchAll();
  };

  if (!member) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={() => navigate('/vips')}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <p className="mt-4 text-sm text-muted-foreground">VIP not found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-3">
      <Button variant="ghost" size="sm" onClick={() => navigate('/vips')}><ArrowLeft className="w-4 h-4 mr-1" /> All VIPs</Button>

      {/* Header */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#E8540A]" />
                <h1 className="text-lg font-bold">{fullName}</h1>
                <Badge className="bg-[#E8540A] text-white border-transparent">VIP</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {member.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {member.phone}</div>}
                {member.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {member.email}</div>}
                {member.birthday && <div className="flex items-center gap-1"><Cake className="w-3 h-3" /> {format(parseISO(member.birthday), 'MMM d')}</div>}
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline">{lifetimeVisitsFor(member)} visits</Badge>
              {member.vip_referral_count > 0 && <Badge variant="outline" className="ml-1">{member.vip_referral_count} referrals</Badge>}
              <div className="text-[10px] text-muted-foreground mt-1">
                Last touch: {member.vip_last_interaction_at ? format(parseISO(member.vip_last_interaction_at), 'MMM d, yyyy') : 'Never'}
              </div>
            </div>
          </div>
          {!isCoach && (
            <div className="flex gap-2 pt-2">
              <Button onClick={() => setLogOpen(true)} className="bg-[#E8540A] hover:bg-[#E8540A]/90 h-11">
                <MessageSquare className="w-4 h-4 mr-1" /> Log touchpoint
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Section title="Class history" count={memberBookings.length} defaultOpen>
        {memberBookings.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No classes yet.</p>
        ) : (
          <div className="space-y-1.5 pt-2">
            {memberBookings.map(b => (
              <div key={b.id} className="text-xs flex items-center justify-between p-2 border rounded">
                <span>{format(parseISO(b.class_date), 'MMM d, yyyy')} {b.intro_time?.slice(0, 5)}</span>
                <span className="text-muted-foreground">{b.coach_name}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Touchpoint history" count={memberTouches.length}>
        {memberTouches.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No touchpoints logged.</p>
        ) : (
          <div className="space-y-1.5 pt-2">
            {memberTouches.map(t => (
              <div key={t.id} className="text-xs p-2 border rounded">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] capitalize">{t.touchpoint_type.replace('_', ' ')}</Badge>
                  <span className="text-muted-foreground">{format(parseISO(t.created_at), 'MMM d, h:mm a')} · {t.staff_name}</span>
                </div>
                {t.notes && <p className="mt-1">{t.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Notes" defaultOpen>
        <div className="pt-2 space-y-2">
          <Textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            disabled={isCoach}
            rows={4}
            placeholder={isCoach ? 'Read-only' : 'Write what you know about them — anything that helps the next person.'}
          />
          {savedFlash && <p className="text-[11px] text-green-600">Saved</p>}
        </div>
      </Section>

      <Section title="Referrals tracked">
        <p className="text-xs text-muted-foreground py-2">
          {member.vip_referral_count} total referrals.
        </p>
      </Section>

      <Section title="Milestones">
        <p className="text-xs text-muted-foreground py-2">
          {Array.isArray(member.vip_milestones) && member.vip_milestones.length > 0
            ? JSON.stringify(member.vip_milestones)
            : 'No milestones yet.'}
        </p>
      </Section>

      <Section title="Birthday & key dates">
        <p className="text-xs py-2">
          {member.birthday ? `Birthday: ${format(parseISO(member.birthday), 'MMMM d')}` : 'No birthday on file.'}
        </p>
      </Section>

      <LogTouchpointDialog
        vipMemberId={member.id}
        memberName={fullName}
        open={logOpen}
        onOpenChange={setLogOpen}
        onLogged={fetchAll}
      />
    </div>
  );
}
