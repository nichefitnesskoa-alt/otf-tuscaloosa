/**
 * SourcedLeadsToText — collapsible list of self-sourced leads waiting on
 * their first text. Used on:
 *   - My Day Today tab (right below "Log a lead you sourced")
 *   - Follow-Up tab (above the FollowUpList)
 *
 * Same component renders both places so the list and the action set stay
 * identical. Sorted: mine first (current SA), then others, oldest at top.
 *
 * Actions per row:
 *   - Text  → opens ScriptSendDrawer pre-loaded with the "Self-Sourced /
 *     First reach-out" template (auto-logs via existing copy handler).
 *   - Booked it  → opens BookIntroDialog; the existing
 *     auto_link_self_sourced_lead_to_booking trigger flips booked_intro_id
 *     by phone match, which removes the row from this list automatically.
 *   - Not interested → sets leads.text_archived_at = now() with a reason.
 *     The lead still counts on the WIG Leads column (lead was sourced; we're
 *     only archiving from the to-text queue).
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { MessageCircle, Phone, MoreVertical, ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { useSourcedLeadsToText } from '@/hooks/useSourcedLeadsToText';
import { fullName, daysSinceLogged, type SourcedLeadRow } from '@/lib/sa/sourcedLeadsToText';
import { stripCountryCode, formatPhoneDisplay } from '@/lib/parsing/phone';
import { ScriptSendDrawer } from '@/components/scripts/ScriptSendDrawer';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { LeadDetailSheet } from '@/components/leads/LeadDetailSheet';
import { notifyDataChanged } from '@/lib/data/invalidation';
import type { Tables } from '@/integrations/supabase/types';

interface Props {
  /** Compact mode (My Day card). Defaults to true. */
  compact?: boolean;
  /** Auto-expand when there are items (used on Follow-Up tab). */
  defaultOpen?: boolean;
}

export function SourcedLeadsToText({ compact = true, defaultOpen = false }: Props) {
  const { user } = useAuth();
  const sa = user?.name || null;
  const { mine, others, total, loading } = useSourcedLeadsToText(sa);
  const [open, setOpen] = useState(defaultOpen);
  const [textingLead, setTextingLead] = useState<SourcedLeadRow | null>(null);
  const [bookingLead, setBookingLead] = useState<SourcedLeadRow | null>(null);

  const empty = !loading && total === 0;

  if (empty && compact) {
    // Hide entirely on My Day when there's nothing to do — keeps the page tight.
    return null;
  }

  const archive = async (lead: SourcedLeadRow, reason: string) => {
    const { error } = await supabase
      .from('leads')
      .update({
        text_archived_at: new Date().toISOString(),
        text_archived_reason: reason,
      })
      .eq('id', lead.id);
    if (error) {
      toast.error('Could not archive lead');
      return;
    }
    await supabase.from('lead_activities').insert({
      lead_id: lead.id,
      activity_type: 'note',
      performed_by: sa || 'system',
      notes: `Archived from text queue: ${reason}`,
    });
    toast.success('Removed from text queue');
    notifyDataChanged(['leads', 'sa-leads']);
  };

  const renderRow = (lead: SourcedLeadRow) => {
    const days = daysSinceLogged(lead);
    const ageColor =
      days >= 7 ? 'bg-destructive text-destructive-foreground'
      : days >= 3 ? 'bg-amber-500 text-white'
      : 'bg-muted text-muted-foreground';
    const phoneClean = stripCountryCode(lead.phone);
    return (
      <div
        key={lead.id}
        className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{fullName(lead)}</p>
            <Badge className={`${ageColor} text-[10px] px-1.5 py-0`}>
              {days === 0 ? 'today' : `${days}d`}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {formatPhoneDisplay(lead.phone) || lead.phone}
            {lead.source ? ` · ${lead.source}` : ''}
            {lead.sourced_by_sa ? ` · by ${lead.sourced_by_sa}` : ''}
          </p>
        </div>
        {phoneClean && (
          <a
            href={`tel:${phoneClean}`}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border text-muted-foreground hover:bg-muted"
            aria-label="Call"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        <Button
          size="sm"
          className="h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setTextingLead(lead)}
        >
          <MessageCircle className="w-4 h-4 mr-1" /> Text
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="More">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setBookingLead(lead)}>
              Booked it
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => archive(lead, 'not_interested')}>
              Not interested
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => archive(lead, 'wrong_number')}>
              Wrong number
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const body = (
    <div className="space-y-3">
      {mine.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold px-1">
            Yours ({mine.length})
          </p>
          {mine.map(renderRow)}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold px-1">
            Other SAs ({others.length})
          </p>
          {others.map(renderRow)}
        </div>
      )}
      {!loading && total === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
          <Inbox className="w-4 h-4" />
          Nothing to text right now. Nice work.
        </div>
      )}
    </div>
  );

  return (
    <>
      <Card className="border border-border bg-card">
        <CardContent className="p-3">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between min-h-[44px] text-left"
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-bold">Text your sourced leads</p>
                <p className="text-[11px] text-muted-foreground">
                  {mine.length > 0
                    ? `${mine.length} of yours waiting${others.length ? ` · ${others.length} on others` : ''}`
                    : others.length > 0
                      ? `${others.length} waiting from other SAs`
                      : 'All caught up'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {total > 0 && (
                <Badge className="bg-primary text-primary-foreground">{total}</Badge>
              )}
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          {open && <div className="mt-3 border-t border-border pt-3">{body}</div>}
        </CardContent>
      </Card>

      {textingLead && (
        <ScriptSendDrawer
          open={!!textingLead}
          onOpenChange={(o) => { if (!o) setTextingLead(null); }}
          leadId={textingLead.id}
          leadName={fullName(textingLead)}
          leadPhone={textingLead.phone}
          categoryFilter={['self_sourced', 'cold_lead', 'ig_dm']}
          defaultCategory="self_sourced"
          saName={sa || ''}
        />
      )}

      {bookingLead && (
        <BookIntroDialog
          open={!!bookingLead}
          onOpenChange={(o) => { if (!o) setBookingLead(null); }}
          lead={bookingLead as unknown as Tables<'leads'>}
          onDone={() => {
            setBookingLead(null);
            notifyDataChanged(['leads', 'intros_booked', 'sa-leads', 'sa-all-booked']);
          }}
        />
      )}
    </>
  );
}
