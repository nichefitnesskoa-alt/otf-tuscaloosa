/**
 * IG DM Tracker tab for MyDay.
 * Manages ig_leads with status banners, booking from DMs, auto-detect booking.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Instagram, Plus, MessageCircle, UserCheck, CalendarPlus, Clock, CheckCircle2, Users, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';

interface IgLead {
  id: string;
  instagram_handle: string;
  first_name: string;
  last_name: string | null;
  phone_number: string | null;
  email: string | null;
  sa_name: string;
  status: string;
  interest_level: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  dm_sent: { label: 'DM Sent', color: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400', icon: <MessageCircle className="w-3 h-3" /> },
  interested: { label: 'Interested in Intro', color: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400', icon: <UserCheck className="w-3 h-3" /> },
  booked: { label: 'Booked', color: 'bg-success/10 text-success border-success/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  waiting_on_friend: { label: 'Waiting on Friend', color: 'bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400', icon: <Users className="w-3 h-3" /> },
  not_interested: { label: 'Not Interested', color: 'bg-muted text-muted-foreground border-border', icon: <X className="w-3 h-3" /> },
  not_booked: { label: 'New', color: 'bg-primary/10 text-primary border-primary/30', icon: <Instagram className="w-3 h-3" /> },
};

interface AddDmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saName: string;
  onAdded: () => void;
}

function AddDmDialog({ open, onOpenChange, saName, onAdded }: AddDmDialogProps) {
  const [igHandle, setIgHandle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!igHandle.trim() || !firstName.trim()) {
      toast.error('IG handle and first name are required');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('ig_leads').insert({
      instagram_handle: igHandle.trim().replace(/^@/, ''),
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      phone_number: phone.trim() || null,
      sa_name: saName,
      status: 'dm_sent',
      interest_level: 'unknown',
      notes: notes.trim() || null,
    });
    if (error) {
      toast.error('Failed to add DM lead');
    } else {
      toast.success('DM lead added!');
      setIgHandle(''); setFirstName(''); setLastName(''); setPhone(''); setNotes('');
      onOpenChange(false);
      onAdded();
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Instagram className="w-4 h-4" />
            Add IG DM Lead
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">IG Handle *</Label>
            <Input value={igHandle} onChange={e => setIgHandle(e.target.value)} placeholder="@username" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">First Name *</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" className="h-9" />
            </div>
            <div>
              <Label className="text-xs">Last Name</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" className="h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Context from their profile" className="h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? 'Adding…' : 'Add DM Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  onCountChange?: (count: number) => void;
}

export function MyDayIgDmTab({ onCountChange }: Props) {
  const { user } = useAuth();
  const [leads, setLeads] = useState<IgLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [bookingLead, setBookingLead] = useState<IgLead | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('ig_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) {
      setLeads(data as IgLead[]);
      const activeCount = data.filter(l => !['booked', 'not_interested'].includes(l.status)).length;
      onCountChange?.(activeCount);
    }
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Auto-detect bookings: poll intros_booked for matches
  useEffect(() => {
    const interval = setInterval(async () => {
      const unbookedLeads = leads.filter(l => l.status !== 'booked' && l.status !== 'not_interested');
      if (unbookedLeads.length === 0) return;

      // Check if any unbooked IG leads now have a matching booking (by name or linked_ig_lead_id)
      const igIds = unbookedLeads.map(l => l.id);
      const { data: linkedBookings } = await supabase
        .from('intros_booked')
        .select('id, linked_ig_lead_id')
        .in('linked_ig_lead_id', igIds)
        .is('deleted_at', null);

      if (linkedBookings && linkedBookings.length > 0) {
        const bookedIgIds = new Set(linkedBookings.map(b => b.linked_ig_lead_id).filter(Boolean));
        for (const igId of bookedIgIds) {
          await supabase.from('ig_leads').update({ status: 'booked' }).eq('id', igId!);
        }
        if (bookedIgIds.size > 0) {
          toast.success(`${bookedIgIds.size} IG lead(s) auto-detected as booked!`);
          fetchLeads();
        }
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [leads, fetchLeads]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('ig_leads').update({ status: newStatus }).eq('id', id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      fetchLeads();
    }
  };

  const handleBookIntro = (lead: IgLead) => {
    setBookingLead(lead);
  };

  const handleBookingDone = async (lead: IgLead) => {
    // Mark as booked
    await supabase.from('ig_leads').update({ status: 'booked' }).eq('id', lead.id);
    setBookingLead(null);
    fetchLeads();
    toast.success(`${lead.first_name} booked for an intro!`);
  };

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter);

  // Summary counts
  const counts = {
    total: leads.length,
    dm_sent: leads.filter(l => l.status === 'dm_sent').length,
    interested: leads.filter(l => l.status === 'interested').length,
    booked: leads.filter(l => l.status === 'booked').length,
    waiting_on_friend: leads.filter(l => l.status === 'waiting_on_friend').length,
  };

  if (loading) return <div className="text-xs text-muted-foreground py-4 text-center">Loading IG DMs…</div>;

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'all', label: 'All', count: counts.total },
          { key: 'dm_sent', label: 'DM Sent', count: counts.dm_sent },
          { key: 'interested', label: 'Interested', count: counts.interested },
          { key: 'waiting_on_friend', label: 'Waiting', count: counts.waiting_on_friend },
          { key: 'booked', label: 'Booked', count: counts.booked },
        ].map(f => (
          <Badge
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            className="cursor-pointer text-[10px] h-6"
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({f.count})
          </Badge>
        ))}
      </div>

      {/* Add button */}
      <Button size="sm" className="w-full gap-1.5" onClick={() => setAddOpen(true)}>
        <Plus className="w-3.5 h-3.5" />
        Add IG DM Lead
      </Button>

      {/* Lead cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No IG DM leads {filter !== 'all' ? `with status "${filter}"` : 'yet'}. Tap + to add one.
        </div>
      ) : (
        filtered.map(lead => {
          const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.not_booked;
          return (
            <Card key={lead.id} className={`border ${lead.status === 'booked' ? 'border-success/40' : lead.status === 'interested' ? 'border-amber-500/40' : 'border-border'}`}>
              <CardContent className="p-3 space-y-2">
                {/* Status banner */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${cfg.color}`}>
                  {cfg.icon}
                  {cfg.label}
                </div>

                {/* Name + IG handle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{lead.first_name} {lead.last_name || ''}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Instagram className="w-3 h-3" />
                      @{lead.instagram_handle}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                  </p>
                </div>

                {/* Phone if available */}
                {lead.phone_number && (
                  <p className="text-xs text-muted-foreground">📱 {lead.phone_number}</p>
                )}

                {/* Notes */}
                {lead.notes && (
                  <p className="text-xs text-muted-foreground italic truncate">📝 {lead.notes}</p>
                )}

                {/* SA attribution */}
                <p className="text-[10px] text-muted-foreground">Added by: {lead.sa_name}</p>

                {/* Action buttons based on status */}
                <div className="flex gap-1.5 pt-1">
                  {lead.status === 'dm_sent' && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" onClick={() => handleStatusChange(lead.id, 'interested')}>
                        <UserCheck className="w-3 h-3 mr-1" /> Interested
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" onClick={() => handleStatusChange(lead.id, 'not_interested')}>
                        <X className="w-3 h-3 mr-1" /> Not Interested
                      </Button>
                    </>
                  )}
                  {lead.status === 'interested' && (
                    <>
                      <Button size="sm" className="h-7 text-[10px] flex-1 bg-primary" onClick={() => handleBookIntro(lead)}>
                        <CalendarPlus className="w-3 h-3 mr-1" /> Book Intro
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleStatusChange(lead.id, 'waiting_on_friend')}>
                        <Users className="w-3 h-3 mr-1" /> Waiting on Friend
                      </Button>
                    </>
                  )}
                  {lead.status === 'waiting_on_friend' && (
                    <Button size="sm" className="h-7 text-[10px] flex-1 bg-primary" onClick={() => handleBookIntro(lead)}>
                      <CalendarPlus className="w-3 h-3 mr-1" /> Book Intro
                    </Button>
                  )}
                  {lead.status === 'not_booked' && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" onClick={() => handleStatusChange(lead.id, 'dm_sent')}>
                        <MessageCircle className="w-3 h-3 mr-1" /> Mark DM Sent
                      </Button>
                    </>
                  )}
                  {lead.status === 'booked' && (
                    <Badge variant="outline" className="text-[10px] text-success border-success/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Intro Booked ✓
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Add DM Dialog */}
      <AddDmDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        saName={user?.name || ''}
        onAdded={fetchLeads}
      />

      {/* Book Intro Dialog - reuse existing */}
      {bookingLead && (
        <BookIntroDialog
          open={!!bookingLead}
          onOpenChange={open => { if (!open) setBookingLead(null); }}
          lead={{
            id: bookingLead.id,
            first_name: bookingLead.first_name,
            last_name: bookingLead.last_name || '',
            phone: bookingLead.phone_number || '',
            email: bookingLead.email || '',
            source: 'Instagram',
            stage: 'contacted',
            created_at: bookingLead.created_at,
            updated_at: bookingLead.updated_at,
          } as any}
          onDone={() => handleBookingDone(bookingLead)}
        />
      )}
    </div>
  );
}
