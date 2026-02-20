/**
 * MyDayNewLeadsTab — New Leads tab content for MyDay.
 * Reads from the `leads` table, shows speed-to-lead banners,
 * colored borders, and action buttons (Script, Book, Copy #, Contacted).
 * Subscribes to real-time inserts so new leads appear without refresh.
 */
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { differenceInMinutes, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, CalendarPlus, MessageSquare, CheckCircle, Phone } from 'lucide-react';
import { StatusBanner } from '@/components/shared/StatusBanner';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';

// Speed-to-lead helpers
function getSpeedInfo(createdAt: string) {
  const minutesSince = differenceInMinutes(new Date(), parseISO(createdAt));
  const hoursSince = minutesSince / 60;
  if (hoursSince >= 4) {
    return {
      color: '#dc2626',
      text: '🔴 Overdue — Contact Now',
    };
  }
  if (hoursSince >= 1) {
    return {
      color: '#d97706',
      text: `⚠ Contact Soon — ${Math.floor(hoursSince)}h since received`,
    };
  }
  return {
    color: '#16a34a',
    text: `✓ New Lead — ${minutesSince}m ago`,
  };
}

interface LeadRowProps {
  lead: Tables<'leads'>;
  onContacted: (id: string) => void;
  onBook: (lead: Tables<'leads'>) => void;
  onScript: (lead: Tables<'leads'>) => void;
}

function LeadRow({ lead, onContacted, onBook, onScript }: LeadRowProps) {
  const speed = getSpeedInfo(lead.created_at);
  const isContacted = lead.stage === 'contacted';
  const isBooked = lead.stage === 'booked' || lead.stage === 'won';

  const handleCopyPhone = async () => {
    if (lead.phone) {
      await navigator.clipboard.writeText(lead.phone);
      toast.success('Phone copied!');
    } else {
      toast.info('No phone on file');
    }
  };

  const borderColor = isBooked
    ? '#16a34a'
    : isContacted
    ? '#6b7280'
    : speed.color;

  const bannerText = isBooked
    ? '✓ Booked'
    : isContacted
    ? '✓ Contacted'
    : speed.text;

  const bannerColor = isBooked ? '#16a34a' : isContacted ? '#6b7280' : speed.color;

  return (
    <div
      className="rounded-lg overflow-hidden bg-card"
      style={{ border: `2px solid ${borderColor}` }}
    >
      <StatusBanner bgColor={bannerColor} text={bannerText} />
      <div className="p-3 space-y-2">
        {/* Name + source */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-[15px] leading-tight">
              {lead.first_name} {lead.last_name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {lead.source}
              </Badge>
              {lead.phone ? (
                <span className="text-[11px] text-muted-foreground">{lead.phone}</span>
              ) : (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                  Phone missing
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {!isBooked && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => onScript(lead)}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Script
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] gap-1"
              onClick={() => onBook(lead)}
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Book
            </Button>
            {lead.phone && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] gap-1"
                onClick={handleCopyPhone}
              >
                <Copy className="w-3.5 h-3.5" />
                Copy #
              </Button>
            )}
            {!isContacted && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px] gap-1 text-muted-foreground"
                onClick={() => onContacted(lead.id)}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Contacted
              </Button>
            )}
          </div>
        )}

        {isBooked && (
          <p className="text-[11px] text-muted-foreground">Intro booked — visible in Today/This Week tabs</p>
        )}
      </div>
    </div>
  );
}

interface MyDayNewLeadsTabProps {
  onCountChange: (count: number) => void;
}

export function MyDayNewLeadsTab({ onCountChange }: MyDayNewLeadsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [leads, setLeads] = useState<Tables<'leads'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookLead, setBookLead] = useState<Tables<'leads'> | null>(null);
  const [scriptLead, setScriptLead] = useState<Tables<'leads'> | null>(null);

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .not('stage', 'in', '("lost")')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) {
      setLeads(data);
      const uncontacted = data.filter(
        l => l.stage === 'new' && !l.booked_intro_id
      ).length;
      onCountChange(uncontacted);
    }
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Real-time subscription — new leads appear instantly
  useEffect(() => {
    const channel = supabase
      .channel('myday-leads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          const newLead = payload.new as Tables<'leads'>;
          setLeads(prev => {
            if (prev.find(l => l.id === newLead.id)) return prev;
            const updated = [newLead, ...prev];
            const uncontacted = updated.filter(
              l => l.stage === 'new' && !l.booked_intro_id
            ).length;
            onCountChange(uncontacted);
            return updated;
          });
          toast.info(`New lead received — ${newLead.first_name} ${newLead.last_name} from ${newLead.source}`);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          const updated = payload.new as Tables<'leads'>;
          setLeads(prev => {
            const next = prev.map(l => l.id === updated.id ? updated : l);
            const uncontacted = next.filter(
              l => l.stage === 'new' && !l.booked_intro_id
            ).length;
            onCountChange(uncontacted);
            return next;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [onCountChange]);

  const handleContacted = async (leadId: string) => {
    await supabase.from('leads').update({ stage: 'contacted' }).eq('id', leadId);
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      activity_type: 'stage_change',
      performed_by: user?.name || 'Unknown',
      notes: 'Marked as Contacted from MyDay',
    });
    fetchLeads();
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

  const handleBookDone = () => {
    setBookLead(null);
    fetchLeads();
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  };

  const scriptMergeContext = scriptLead
    ? {
        'first-name': scriptLead.first_name,
        'last-name': scriptLead.last_name,
        'sa-name': user?.name || '',
        'location-name': 'Tuscaloosa',
      }
    : {};

  // Only show new + contacted + booked (not lost)
  const visibleLeads = leads.filter(l => l.stage !== 'lost');
  // Sort: new first, then contacted, then booked
  const sorted = [...visibleLeads].sort((a, b) => {
    const order = { new: 0, contacted: 1, booked: 2, won: 3 };
    const ao = order[a.stage as keyof typeof order] ?? 4;
    const bo = order[b.stage as keyof typeof order] ?? 4;
    if (ao !== bo) return ao - bo;
    // Within new, sort by created_at ascending (oldest/most urgent first)
    if (a.stage === 'new' && b.stage === 'new') {
      return a.created_at.localeCompare(b.created_at);
    }
    return b.created_at.localeCompare(a.created_at);
  });

  if (loading) {
    return <div className="text-sm text-muted-foreground py-6 text-center">Loading leads…</div>;
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground text-sm">No active leads right now</p>
        <p className="text-muted-foreground text-xs mt-1">New email-parsed leads will appear here instantly</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {sorted.map(lead => (
        <LeadRow
          key={lead.id}
          lead={lead}
          onContacted={handleContacted}
          onBook={setBookLead}
          onScript={setScriptLead}
        />
      ))}

      {bookLead && (
        <BookIntroDialog
          open={!!bookLead}
          onOpenChange={open => { if (!open) setBookLead(null); }}
          lead={bookLead}
          onDone={handleBookDone}
        />
      )}

      {scriptLead && (
        <ScriptPickerSheet
          open={!!scriptLead}
          onOpenChange={open => { if (!open) setScriptLead(null); }}
          suggestedCategories={['speed_to_lead', 'new_lead', 'follow_up']}
          mergeContext={scriptMergeContext}
          onLogged={() => setScriptLead(null)}
        />
      )}
    </div>
  );
}
