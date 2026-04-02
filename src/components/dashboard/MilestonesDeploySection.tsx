import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Plus, PartyPopper, Rocket, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface MilestoneRow {
  id: string;
  entry_type: string;
  member_name: string;
  milestone_type: string | null;
  five_class_pack_gifted: boolean;
  friend_name: string | null;
  friend_contact: string | null;
  converted_to_lead_id: string | null;
  deploy_item_given: string | null;
  deploy_converted: boolean;
  created_by: string;
  created_at: string;
}

interface WeekSummary {
  celebrations: number;
  packs: number;
  friends: number;
  deployed: number;
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function isPhone(s: string) {
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 11;
}

export function MilestonesDeploySection() {
  const { user } = useAuth();
  const [tab, setTab] = useState('celebrations');
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [deploys, setDeploys] = useState<MilestoneRow[]>([]);
  const [summary, setSummary] = useState<WeekSummary>({ celebrations: 0, packs: 0, friends: 0, deployed: 0 });
  const [loading, setLoading] = useState(true);

  // Celebration form
  const [celOpen, setCelOpen] = useState(false);
  const [celName, setCelName] = useState('');
  const [celType, setCelType] = useState('');
  const [celPack, setCelPack] = useState(false);
  const [celFriendName, setCelFriendName] = useState('');
  const [celFriendContact, setCelFriendContact] = useState('');
  const [celSaving, setCelSaving] = useState(false);
  const [celPipelineMsg, setCelPipelineMsg] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);

  // Deploy form
  const [depOpen, setDepOpen] = useState(false);
  const [depName, setDepName] = useState('');
  const [depItem, setDepItem] = useState('');
  const [depSaving, setDepSaving] = useState(false);

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [milRes, depRes] = await Promise.all([
      supabase
        .from('milestones')
        .select('*')
        .eq('entry_type', 'milestone')
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd + 'T23:59:59')
        .order('created_at', { ascending: false }),
      supabase
        .from('milestones')
        .select('*')
        .eq('entry_type', 'deploy')
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd + 'T23:59:59')
        .order('created_at', { ascending: false }),
    ]);

    const mils = (milRes.data || []) as unknown as MilestoneRow[];
    const deps = (depRes.data || []) as unknown as MilestoneRow[];
    setMilestones(mils);
    setDeploys(deps);
    setSummary({
      celebrations: mils.length,
      packs: mils.filter(m => m.five_class_pack_gifted).length,
      friends: mils.filter(m => m.converted_to_lead_id).length,
      deployed: deps.length,
    });
    setLoading(false);
  }, [weekStart, weekEnd]);

  useEffect(() => { loadData(); }, [loadData]);

  const checkPipelineAndCreateLead = async (friendName: string, friendContact: string, milestoneId: string) => {
    const contact = friendContact.trim().toLowerCase();
    if (!contact) return;

    // Check leads, intros_booked, ig_leads
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

    // Create lead
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
        source: 'Milestone Referral',
        stage: 'new',
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
    setCelName('');
    setCelType('');
    setCelPack(false);
    setCelFriendName('');
    setCelFriendContact('');
    setCelOpen(false);
    setCelPipelineMsg(null);
    loadData();
  };

  const handleDeploySubmit = async () => {
    if (!depName.trim() || !depItem || !user?.name) return;
    setDepSaving(true);

    const { error } = await supabase
      .from('milestones')
      .insert({
        entry_type: 'deploy',
        member_name: depName.trim(),
        deploy_item_given: depItem,
        created_by: user.name,
      } as any);

    if (error) {
      toast.error('Failed to save');
      setDepSaving(false);
      return;
    }

    toast.success('Deploy saved!');
    setDepSaving(false);
    setDepName('');
    setDepItem('');
    setDepOpen(false);
    loadData();
  };

  const toggleDeployConverted = async (id: string, current: boolean) => {
    const newVal = !current;
    setDeploys(prev => prev.map(d => d.id === id ? { ...d, deploy_converted: newVal } : d));
    await supabase.from('milestones').update({ deploy_converted: newVal } as any).eq('id', id);
  };

  const summaryCards = [
    { label: 'Celebrations', value: summary.celebrations },
    { label: 'Packs gifted', value: summary.packs },
    { label: 'Friends in pipeline', value: summary.friends },
    { label: 'Members deployed', value: summary.deployed },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Milestones & Deploy</p>

      {/* Weekly summary */}
      <div className="grid grid-cols-4 gap-2">
        {summaryCards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold">{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="celebrations" className="gap-1">
            <PartyPopper className="w-3.5 h-3.5" /> Celebrations
          </TabsTrigger>
          <TabsTrigger value="deploy" className="gap-1">
            <Rocket className="w-3.5 h-3.5" /> Deploy 5
          </TabsTrigger>
        </TabsList>

        {/* CELEBRATIONS TAB */}
        <TabsContent value="celebrations" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Dialog open={celOpen} onOpenChange={(o) => { setCelOpen(o); if (!o) setCelPipelineMsg(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 h-8 text-xs">
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

          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
          ) : milestones.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No celebrations this week.</p>
          ) : (
            <Card className="divide-y divide-border">
              {milestones.map(m => (
                <div key={m.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{m.member_name}</span>
                      <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 text-[9px] h-4">{m.milestone_type}</Badge>
                      {m.five_class_pack_gifted && <Check className="w-3.5 h-3.5 text-green-500" />}
                      {m.converted_to_lead_id && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/20 text-[9px] h-4">In pipeline</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {m.created_by} · {format(new Date(m.created_at), 'EEE h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        {/* DEPLOY TAB */}
        <TabsContent value="deploy" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Dialog open={depOpen} onOpenChange={setDepOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 h-8 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Deploy Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Deploy Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Member name *</Label>
                    <Input value={depName} onChange={e => setDepName(e.target.value)} placeholder="Member name" />
                  </div>
                  <div>
                    <Label className="text-xs">What did you give them? *</Label>
                    <Select value={depItem} onValueChange={setDepItem}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Marketing Materials">Marketing Materials</SelectItem>
                        <SelectItem value="VIP Event Contact">VIP Event Contact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleDeploySubmit} disabled={depSaving || !depName.trim() || !depItem} className="w-full">
                    {depSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>
          ) : deploys.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No deployments this week.</p>
          ) : (
            <Card className="divide-y divide-border">
              {deploys.map(d => (
                <div key={d.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{d.member_name}</span>
                      <Badge variant="outline" className="text-[9px] h-4">{d.deploy_item_given}</Badge>
                      {d.deploy_converted && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20 text-[9px] h-4">Converted</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {d.created_by} · {format(new Date(d.created_at), 'EEE h:mm a')}
                    </p>
                  </div>
                  {!d.deploy_converted && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] px-2 text-muted-foreground"
                      onClick={() => toggleDeployConverted(d.id, d.deploy_converted)}
                    >
                      Mark converted
                    </Button>
                  )}
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
