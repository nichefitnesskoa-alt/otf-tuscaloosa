import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Check, Plus, PartyPopper, AlertTriangle, Pencil, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface MilestoneRow {
  id: string;
  entry_type: string;
  member_name: string;
  milestone_type: string | null;
  five_class_pack_gifted: boolean;
  actually_celebrated: boolean;
  friend_name: string | null;
  friend_contact: string | null;
  converted_to_lead_id: string | null;
  deploy_item_given: string | null;
  deploy_converted: boolean;
  created_by: string;
  created_at: string;
  last_edited_by?: string | null;
  last_edited_at?: string | null;
  friend_showed_up?: boolean;
}

interface WeekSummary {
  celebrations: number;
  actuallyCelebrated: number;
  packs: number;
  friends: number;
  deployed: number;
  converted: number;
  friendsShowedUp: number;
  convertedToMember: number;
}

interface FriendTrackingInfo {
  friendShowedUp: boolean;
  convertedToMember: boolean;
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

interface MilestonesDeploySectionProps {
  dateRange?: { start: Date; end: Date } | null;
}

export function MilestonesDeploySection({ dateRange }: MilestonesDeploySectionProps = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('celebrations');
  const [celSearch, setCelSearch] = useState('');
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [summary, setSummary] = useState<WeekSummary>({ celebrations: 0, actuallyCelebrated: 0, packs: 0, friends: 0, deployed: 0, converted: 0, friendsShowedUp: 0, convertedToMember: 0 });
  const [friendTracking, setFriendTracking] = useState<Map<string, FriendTrackingInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  // Create form state
  const [celOpen, setCelOpen] = useState(false);
  const [celName, setCelName] = useState('');
  const [celType, setCelType] = useState('');
  const [celPack, setCelPack] = useState(false);
  const [celFriendName, setCelFriendName] = useState('');
  const [celFriendContact, setCelFriendContact] = useState('');
  const [celSaving, setCelSaving] = useState(false);
  const [celPipelineMsg, setCelPipelineMsg] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);
  const [celCelebrated, setCelCelebrated] = useState(false);

  // Edit form state
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<MilestoneRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editPack, setEditPack] = useState(false);
  const [editFriendName, setEditFriendName] = useState('');
  const [editFriendContact, setEditFriendContact] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editCelebrated, setEditCelebrated] = useState(false);

  const rangeStartYMD = dateRange ? format(dateRange.start, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-01');
  const rangeEndYMD = dateRange ? format(dateRange.end, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  const loadData = useCallback(async () => {
    setLoading(true);
    const milRes = await supabase
      .from('milestones')
      .select('*')
      .eq('entry_type', 'milestone')
      .gte('created_at', rangeStartYMD)
      .lte('created_at', rangeEndYMD + 'T23:59:59')
      .order('created_at', { ascending: false });

    const mils = (milRes.data || []) as unknown as MilestoneRow[];
    setMilestones(mils);

    // Track pack friend show-ups and conversions
    const packFriends = mils.filter(m => m.five_class_pack_gifted && m.friend_name);
    const trackingMap = new Map<string, FriendTrackingInfo>();
    let totalShowedUp = 0;
    let totalConverted = 0;

    if (packFriends.length > 0) {
      for (const pf of packFriends) {
        const friendName = (pf.friend_name || '').trim();
        if (!friendName) continue;

        let friendShowedUp = !!(pf as any).friend_showed_up;
        let converted = false;

        // Detection 1: Search intros_booked by name for SHOWED status
        const { data: bookings } = await supabase
          .from('intros_booked')
          .select('id, booking_status_canon')
          .ilike('member_name', friendName);

        const bookedIds = (bookings || []).map((b: any) => b.id);
        const hasShowed = (bookings || []).some((b: any) => b.booking_status_canon === 'SHOWED');

        if (hasShowed) {
          friendShowedUp = true;
        }

        // Detection 2: Check leads with source 'Member Referral (5 class pack)'
        if (!friendShowedUp) {
          const nameParts = friendName.split(/\s+/);
          const firstName = nameParts[0] || '';
          if (firstName) {
            const { data: leads } = await supabase
              .from('leads')
              .select('booked_intro_id')
              .ilike('first_name', firstName)
              .eq('source', 'Member Referral (5 class pack)')
              .not('booked_intro_id', 'is', null)
              .limit(5);
            if (leads && leads.length > 0) {
              const leadBookingIds = leads.map((l: any) => l.booked_intro_id).filter(Boolean);
              if (leadBookingIds.length > 0) {
                const { data: leadBookings } = await supabase
                  .from('intros_booked')
                  .select('id, booking_status_canon')
                  .in('id', leadBookingIds);
                if ((leadBookings || []).some((b: any) => b.booking_status_canon === 'SHOWED')) {
                  friendShowedUp = true;
                  (leadBookings || []).forEach((b: any) => { if (!bookedIds.includes(b.id)) bookedIds.push(b.id); });
                }
              }
            }
          }
        }

        // Check if any run resulted in SALE
        if (bookedIds.length > 0) {
          const { data: runs } = await supabase
            .from('intros_run')
            .select('result_canon')
            .in('linked_intro_booked_id', bookedIds);
          converted = (runs || []).some((r: any) => r.result_canon === 'SALE');
        }

        // Auto-update friend_showed_up in DB if detected but not stored
        if (friendShowedUp && !(pf as any).friend_showed_up) {
          await supabase.from('milestones').update({ friend_showed_up: true } as any).eq('id', pf.id);
        }

        trackingMap.set(pf.id, { friendShowedUp, convertedToMember: converted });
        if (friendShowedUp) totalShowedUp++;
        if (converted) totalConverted++;
      }
    }

    setFriendTracking(trackingMap);
    setSummary({
      celebrations: mils.length,
      actuallyCelebrated: mils.filter(m => m.actually_celebrated).length,
      packs: mils.filter(m => m.five_class_pack_gifted).length,
      friends: mils.filter(m => m.converted_to_lead_id).length,
      deployed: 0,
      converted: 0,
      friendsShowedUp: totalShowedUp,
      convertedToMember: totalConverted,
    });
    setLoading(false);
  }, [rangeStartYMD, rangeEndYMD]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime: re-run friend detection when pipeline/leads/intros change
  useEffect(() => {
    const channel = supabase
      .channel('friend-showup-detect')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_booked' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intros_run' }, () => loadData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadData]);

  const checkPipelineAndCreateLead = async (friendName: string, friendContact: string, milestoneId: string) => {
    const contact = friendContact.trim().toLowerCase();
    if (!contact) return;

    const isEmailContact = isEmail(contact);
    const phoneDigits = contact.replace(/\D/g, '');

    const checks = await Promise.all([
      isEmailContact
        ? supabase.from('leads').select('first_name, last_name').ilike('email', contact).limit(1)
        : supabase.from('leads').select('first_name, last_name').ilike('phone', `%${phoneDigits.slice(-10)}%`).limit(1),
      isEmailContact
        ? supabase.from('intros_booked').select('member_name').ilike('email', contact).limit(1)
        : supabase.from('intros_booked').select('member_name').ilike('phone', `%${phoneDigits.slice(-10)}%`).limit(1),
      isEmailContact
        ? supabase.from('ig_leads').select('first_name').ilike('email', contact).limit(1)
        : supabase.from('ig_leads').select('first_name').ilike('phone_number', `%${phoneDigits.slice(-10)}%`).limit(1),
    ]);

    const matchedName =
      checks[0].data?.[0] ? `${(checks[0].data[0] as any).first_name} ${(checks[0].data[0] as any).last_name}` :
      checks[1].data?.[0] ? (checks[1].data[0] as any).member_name :
      checks[2].data?.[0] ? (checks[2].data[0] as any).first_name : null;

    if (matchedName) {
      setCelPipelineMsg({ type: 'warning', text: `This contact may already exist in the pipeline: ${matchedName}` });
      return;
    }

    const nameParts = friendName.trim().split(/\s+/);
    const firstName = nameParts[0] || friendName;
    const lastName = nameParts.slice(1).join(' ') || '';

    const { data: newLead } = await supabase
      .from('leads')
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone: isEmailContact ? '' : friendContact.trim(),
        email: isEmailContact ? friendContact.trim() : null,
        source: 'Member Referral (5 class pack)',
        stage: 'new',
        duplicate_notes: `Referred via milestone pack — ${editItem?.member_name || ''} celebrated on ${format(new Date(), 'MMM d, yyyy')}`,
      } as any)
      .select('id')
      .single();

    if (newLead) {
      await supabase
        .from('milestones')
        .update({ converted_to_lead_id: (newLead as any).id } as any)
        .eq('id', milestoneId);
      setCelPipelineMsg({ type: 'success', text: 'Added to lead pipeline.' });
    }
  };

  const handleCelebrationSubmit = async () => {
    if (!celName.trim() || !celType.trim() || !user?.name) return;
    setCelSaving(true);
    setCelPipelineMsg(null);

    const { data, error } = await supabase
      .from('milestones')
      .insert({
        entry_type: 'milestone',
        member_name: celName.trim(),
        milestone_type: celType.trim(),
        five_class_pack_gifted: celPack,
        actually_celebrated: celCelebrated,
        friend_name: celFriendName.trim() || null,
        friend_contact: celFriendContact.trim() || null,
        created_by: user.name,
      } as any)
      .select('id')
      .single();

    if (error) {
      toast.error('Failed to save');
      setCelSaving(false);
      return;
    }

    if (celFriendName.trim() && celFriendContact.trim() && data) {
      await checkPipelineAndCreateLead(celFriendName, celFriendContact, (data as any).id);
    }

    toast.success('Celebration saved!');
    setCelSaving(false);
    setCelName(''); setCelType(''); setCelPack(false); setCelCelebrated(false);
    setCelFriendName(''); setCelFriendContact('');
    setCelOpen(false); setCelPipelineMsg(null);
    loadData();
  };

  const openEdit = (item: MilestoneRow) => {
    setEditItem(item);
    setEditName(item.member_name);
    setEditType(item.milestone_type || '');
    setEditPack(item.five_class_pack_gifted);
    setEditCelebrated(item.actually_celebrated ?? false);
    setEditFriendName(item.friend_name || '');
    setEditFriendContact(item.friend_contact || '');
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editItem || !user?.name) return;
    setEditSaving(true);

    const updates: Record<string, any> = {
      member_name: editName.trim(),
      last_edited_by: user.name,
      last_edited_at: new Date().toISOString(),
    };

    if (editItem.entry_type === 'milestone') {
      updates.milestone_type = editType.trim();
      updates.five_class_pack_gifted = editPack;
      updates.actually_celebrated = editCelebrated;
      updates.friend_name = editFriendName.trim() || null;
      updates.friend_contact = editFriendContact.trim() || null;
    }

    const { error } = await supabase
      .from('milestones')
      .update(updates as any)
      .eq('id', editItem.id);

    if (error) {
      toast.error('Failed to update');
      setEditSaving(false);
      return;
    }

    toast.success('Updated');
    setEditSaving(false);
    setEditOpen(false);
    setEditItem(null);
    loadData();
  };

  const navigateToLead = (leadId: string) => {
    navigate('/pipeline?leadId=' + leadId);
  };

  const celebratedColor = summary.celebrations === 0
    ? 'text-foreground'
    : summary.actuallyCelebrated === summary.celebrations
      ? 'text-success'
      : summary.actuallyCelebrated > 0
        ? 'text-amber-500'
        : 'text-destructive';

  const summaryCards = [
    { label: 'Celebrated', value: `${summary.actuallyCelebrated} / ${summary.celebrations}`, className: celebratedColor },
    { label: 'Packs gifted', value: String(summary.packs) },
    { label: 'Friends showed up', value: String(summary.friendsShowedUp) },
    { label: 'Converted to member', value: String(summary.convertedToMember) },
    { label: 'Friends in pipeline', value: String(summary.friends) },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Milestones</p>

      {/* Weekly summary */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {summaryCards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${'className' in c && c.className ? c.className : ''}`}>{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Celebrations */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <PartyPopper className="w-3.5 h-3.5" />
          <span className="text-sm font-semibold">Celebrations</span>
        </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={celSearch}
                onChange={e => setCelSearch(e.target.value)}
                placeholder="Search member or friend name…"
                className="h-[44px] pl-9 text-sm"
              />
            </div>
            <Dialog open={celOpen} onOpenChange={(o) => { setCelOpen(o); if (!o) setCelPipelineMsg(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 h-[44px] text-xs px-3">
                  <Plus className="w-3.5 h-3.5" /> Add Celebration
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Celebration</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Member name *</Label>
                    <Input value={celName} onChange={e => setCelName(e.target.value)} placeholder="Member name" />
                  </div>
                  <div>
                    <Label className="text-xs">Milestone type *</Label>
                    <Input value={celType} onChange={e => setCelType(e.target.value)} placeholder="e.g. 100, 500, Birthday" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={celCelebrated} onCheckedChange={setCelCelebrated} />
                    <Label className="text-xs">Actually celebrated in studio?</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={celPack} onCheckedChange={setCelPack} />
                    <Label className="text-xs">5-class pack gifted?</Label>
                  </div>
                  {celPack && (
                    <>
                      <div>
                        <Label className="text-xs">Friend name</Label>
                        <Input value={celFriendName} onChange={e => setCelFriendName(e.target.value)} placeholder="Friend's name" />
                      </div>
                      <div>
                        <Label className="text-xs">Friend contact (phone or email)</Label>
                        <Input value={celFriendContact} onChange={e => setCelFriendContact(e.target.value)} placeholder="Phone or email" />
                      </div>
                    </>
                  )}
                  {celPipelineMsg && (
                    <div className={`flex items-center gap-2 text-xs p-2 rounded ${celPipelineMsg.type === 'warning' ? 'bg-warning/10 text-warning' : 'bg-green-500/10 text-green-500'}`}>
                      {celPipelineMsg.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Check className="w-3.5 h-3.5 shrink-0" />}
                      {celPipelineMsg.text}
                    </div>
                  )}
                  <Button onClick={handleCelebrationSubmit} disabled={celSaving || !celName.trim() || !celType.trim()} className="w-full">
                    {celSaving ? 'Saving…' : 'Save Celebration'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {(() => {
            const searchTerm = celSearch.toLowerCase().trim();
            const filtered = searchTerm
              ? milestones.filter(m =>
                  m.member_name.toLowerCase().includes(searchTerm) ||
                  (m.friend_name || '').toLowerCase().includes(searchTerm)
                )
              : milestones;

            return loading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{searchTerm ? 'No matches found.' : 'No celebrations this week.'}</p>
            ) : (
              <Card className="divide-y divide-border">
                {filtered.map(m => (
                  <div key={m.id} className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{m.member_name}</span>
                        <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 text-[9px] h-4">{m.milestone_type}</Badge>
                        {m.five_class_pack_gifted && (
                          <Badge className="bg-success/20 text-success border-success/40 hover:bg-success/20 text-[9px] h-4">Pack gifted</Badge>
                        )}
                        {m.actually_celebrated ? (
                          <Badge className="bg-success/20 text-success border-success/40 hover:bg-success/20 text-[9px] h-4">Celebrated</Badge>
                        ) : (
                          <Badge className="bg-warning/20 text-warning border-warning/40 hover:bg-warning/20 text-[9px] h-4">Not yet celebrated</Badge>
                        )}
                        {m.converted_to_lead_id ? (
                          <Badge
                            className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30 text-[9px] h-4 cursor-pointer gap-1"
                            onClick={(e) => { e.stopPropagation(); navigateToLead(m.converted_to_lead_id!); }}
                          >
                            In pipeline <ExternalLink className="w-2.5 h-2.5" />
                          </Badge>
                        ) : m.friend_name ? (
                          <Badge className="bg-warning/20 text-warning border-warning/40 hover:bg-warning/20 text-[9px] h-4">Not in pipeline</Badge>
                        ) : null}
                        {m.five_class_pack_gifted && m.friend_name && (() => {
                          const info = friendTracking.get(m.id);
                          const showedUp = info?.friendShowedUp || false;
                          const converted = info?.convertedToMember || false;
                          return (
                            <>
                              {showedUp ? (
                                <Badge className="bg-success/20 text-success border-success/40 hover:bg-success/20 text-[9px] h-4">Friend Showed Up</Badge>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] px-3 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground font-semibold"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await supabase.from('milestones').update({ friend_showed_up: true } as any).eq('id', m.id);
                                    toast.success('Marked as showed up');
                                    loadData();
                                  }}
                                >
                                  <Check className="w-3 h-3 mr-1" /> They Came In
                                </Button>
                              )}
                              {converted ? (
                                <Badge className="bg-success/20 text-success border-success/40 hover:bg-success/20 text-[9px] h-4">Converted to Member</Badge>
                              ) : showedUp ? (
                                <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted text-[9px] h-4">Not yet converted</Badge>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                      {m.friend_name && !m.converted_to_lead_id && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 italic">Friend: {m.friend_name}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {m.created_by} · {format(new Date(m.created_at), 'EEE h:mm a')}
                        {m.last_edited_by && (
                          <span className="ml-1">· edited by {m.last_edited_by}</span>
                        )}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(m)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </Card>
            );
          })()}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Celebration</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Member name *</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Milestone type *</Label>
                <Input value={editType} onChange={e => setEditType(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editCelebrated} onCheckedChange={setEditCelebrated} />
                <Label className="text-xs">Actually celebrated in studio?</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editPack} onCheckedChange={setEditPack} />
                <Label className="text-xs">5-class pack gifted?</Label>
              </div>
              {editPack && (
                <>
                  <div>
                    <Label className="text-xs">Friend name</Label>
                    <Input value={editFriendName} onChange={e => setEditFriendName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Friend contact</Label>
                    <Input value={editFriendContact} onChange={e => setEditFriendContact(e.target.value)} />
                  </div>
                </>
              )}
              <p className="text-[10px] text-muted-foreground">
                Created by {editItem.created_by} · {format(new Date(editItem.created_at), 'MMM d, h:mm a')}
              </p>
              <Button
                onClick={handleEditSave}
                disabled={editSaving || !editName.trim() || !editType.trim()}
                className="w-full"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
