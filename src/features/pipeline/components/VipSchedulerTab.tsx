/**
 * VIP Scheduler Tab — manage available VIP session slots.
 * Staff can add slots, cancel, reset, copy the public link, and view registrations.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  CalendarPlus, Copy, Eye, XCircle, RotateCcw, Loader2, Users, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { formatDisplayTime } from '@/lib/time/timeUtils';

interface VipSession {
  id: string;
  vip_class_name: string;
  session_date: string;
  session_time: string;
  status: string;
  reserved_by_group: string | null;
  description: string | null;
  is_on_availability_page: boolean;
  shareable_slug: string | null;
  created_by: string;
  reserved_contact_name: string | null;
  reserved_contact_email: string | null;
  reserved_contact_phone: string | null;
  estimated_group_size: number | null;
  created_at: string;
}

interface VipRegistration {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

function generateSlug(date: string, time: string): string {
  const d = new Date(date + 'T00:00:00');
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const month = monthNames[d.getMonth()];
  const day = d.getDate();
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const min = m || '00';
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `vip-${month}${day}-${h12}${min !== '00' ? min : ''}${ampm}`;
}

function StatusBadge({ status, group }: { status: string; group: string | null }) {
  if (status === 'open') return <Badge className="bg-green-600 text-white border-transparent text-xs">Open</Badge>;
  if (status === 'reserved') return <Badge className="bg-amber-500 text-white border-transparent text-xs">Reserved — {group}</Badge>;
  if (status === 'cancelled') return <Badge className="bg-red-600 text-white border-transparent text-xs">Cancelled</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

export function VipSchedulerTab() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<VipSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [regOpen, setRegOpen] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<VipRegistration[]>([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});

  // Add slot form state
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const sessQuery: any = supabase
      .from('vip_sessions')
      .select('*')
      .order('session_date', { ascending: true })
      .order('session_time', { ascending: true });
    const { data } = await sessQuery;
    setSessions((data as any[]) || []);

    // Fetch registration counts per session
    if (data && data.length > 0) {
      const ids = data.map((s: any) => s.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: regs } = await sb
        .from('vip_registrations')
        .select('vip_session_id')
        .in('vip_session_id', ids);
      const counts: Record<string, number> = {};
      for (const r of (regs || [])) {
        const sid = (r as any).vip_session_id;
        counts[sid] = (counts[sid] || 0) + 1;
      }
      setRegCounts(counts);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleAddSlot = async () => {
    if (!newDate || !newTime) { toast.error('Date and time are required'); return; }
    setSaving(true);
    try {
      const slug = generateSlug(newDate, newTime);
      const { error } = await supabase.from('vip_sessions').insert({
        vip_class_name: `VIP ${format(new Date(newDate + 'T00:00:00'), 'MMM d')}`,
        session_date: newDate,
        session_time: newTime,
        status: 'open',
        description: newDesc || null,
        is_on_availability_page: newPublic,
        shareable_slug: slug,
        created_by: user?.name || 'Admin',
      } as any);
      if (error) throw error;
      toast.success('Slot added');
      setAddOpen(false);
      setNewDate('');
      setNewTime('');
      setNewDesc('');
      setNewPublic(true);
      fetchSessions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add slot');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    await supabase.from('vip_sessions').update({ status: 'cancelled' } as any).eq('id', id);
    toast.success('Slot cancelled');
    fetchSessions();
  };

  const handleResetToOpen = async (id: string) => {
    await supabase.from('vip_sessions').update({
      status: 'open',
      reserved_by_group: null,
      reserved_contact_name: null,
      reserved_contact_email: null,
      reserved_contact_phone: null,
      estimated_group_size: null,
    } as any).eq('id', id);
    toast.success('Slot reset to open');
    fetchSessions();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/vip-availability`;
    navigator.clipboard.writeText(url);
    toast.success('Availability link copied');
  };

  const handleViewRegistrations = async (sessionId: string) => {
    setRegOpen(sessionId);
    setRegLoading(true);
    const { data } = await supabase
      .from('vip_registrations')
      .select('id, full_name, email, phone')
      .eq('vip_session_id', sessionId);
    setRegistrations((data as any[]) || []);
    setRegLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">VIP Session Scheduler</h2>
          <p className="text-xs text-muted-foreground">Manage available slots for private group classes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={handleCopyLink}>
            <Copy className="w-3.5 h-3.5" /> Copy Availability Link
          </Button>
          <Button size="sm" className="h-9 text-xs gap-1 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => setAddOpen(true)}>
            <CalendarPlus className="w-3.5 h-3.5" /> Add Available Slot
          </Button>
        </div>
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No VIP sessions yet. Add a slot to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map(s => (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">
                      {format(new Date(s.session_date + 'T00:00:00'), 'EEE, MMM d')} · {formatDisplayTime(s.session_time)}
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
                  </div>
                  <StatusBadge status={s.status} group={s.reserved_by_group} />
                  {s.status === 'reserved' && regCounts[s.id] !== undefined && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {regCounts[s.id]} registered
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={handleCopyLink}>
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </Button>
                  {s.status === 'reserved' && (
                    <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={() => handleViewRegistrations(s.id)}>
                      <Eye className="w-3.5 h-3.5" /> View Registrations
                    </Button>
                  )}
                  {s.status === 'reserved' && (
                    <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-muted-foreground" onClick={() => handleResetToOpen(s.id)}>
                      <RotateCcw className="w-3.5 h-3.5" /> Reset to Open
                    </Button>
                  )}
                  {s.status !== 'cancelled' && (
                    <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-destructive" onClick={() => handleCancel(s.id)}>
                      <XCircle className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Slot Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Available Slot</DialogTitle>
            <DialogDescription>Create a new VIP session time slot</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="border" />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="border" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="e.g. Morning exclusive session"
                className="border"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show on public availability page</Label>
              <Switch checked={newPublic} onCheckedChange={setNewPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleAddSlot}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Add Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Registrations Dialog */}
      <Dialog open={!!regOpen} onOpenChange={() => setRegOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrations</DialogTitle>
            <DialogDescription>People registered for this VIP session</DialogDescription>
          </DialogHeader>
          {regLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No registrations yet</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {(() => {
                const session = sessions.find(s => s.id === regOpen);
                return session?.reserved_contact_name ? (
                  <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                    <CardContent className="p-3 space-y-1">
                      <div className="text-xs font-semibold text-orange-700 dark:text-orange-400">Group Contact</div>
                      <div className="text-sm font-medium">{session.reserved_contact_name}</div>
                      {session.reserved_contact_email && <div className="text-xs text-muted-foreground">{session.reserved_contact_email}</div>}
                      {session.reserved_contact_phone && (
                        <a href={`tel:${session.reserved_contact_phone}`} className="text-xs text-primary underline">
                          {session.reserved_contact_phone}
                        </a>
                      )}
                      {session.estimated_group_size && (
                        <div className="text-xs text-muted-foreground">Estimated group size: {session.estimated_group_size}</div>
                      )}
                    </CardContent>
                  </Card>
                ) : null;
              })()}
              <Separator />
              {registrations.map(r => (
                <div key={r.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="font-medium">{r.full_name}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {r.email && <span>{r.email}</span>}
                    {r.phone && <span>{r.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
