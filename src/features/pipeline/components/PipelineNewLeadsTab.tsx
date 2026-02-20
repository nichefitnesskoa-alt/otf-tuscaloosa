/**
 * PipelineNewLeadsTab — New Leads sub-tab for Pipeline.
 * Same data source as MyDay New Leads. Sub-tabs: New | Flagged | Contacted | Booked | Already in System
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { differenceInMinutes, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Copy, CalendarPlus, MessageSquare, CheckCircle,
  MoreVertical, AlertTriangle, Ban, RotateCcw, Info,
} from 'lucide-react';
import { StatusBanner } from '@/components/shared/StatusBanner';
import { BookIntroDialog } from '@/components/leads/BookIntroDialog';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';

type Lead = Tables<'leads'> & {
  duplicate_notes?: string | null;
  duplicate_confidence?: string | null;
  duplicate_match_type?: string | null;
  duplicate_override?: boolean | null;
};

type LeadAction = 'contacted' | 'move_to_new' | 'confirm_duplicate' | 'confirm_not_duplicate';

function getSpeedInfo(createdAt: string) {
  const minutesSince = differenceInMinutes(new Date(), parseISO(createdAt));
  const hoursSince = minutesSince / 60;
  if (hoursSince >= 4) return { color: '#dc2626', text: '🔴 Overdue — Contact Now' };
  if (hoursSince >= 1) return { color: '#d97706', text: `⚠ Contact Soon — ${Math.floor(hoursSince)}h since received` };
  return { color: '#16a34a', text: `✓ New Lead — ${minutesSince}m ago` };
}

function LeadCard({ lead, onAction, onBook, onScript }: {
  lead: Lead;
  onAction: (id: string, action: LeadAction) => void;
  onBook: (lead: Lead) => void;
  onScript: (lead: Lead) => void;
}) {
  const stage = lead.stage;
  const isFlagged = stage === 'flagged';
  const isContacted = stage === 'contacted';
  const isBooked = stage === 'booked' || stage === 'won';
  const isAlreadyInSystem = stage === 'already_in_system';
  const hasLowFlag = stage === 'new' && lead.duplicate_confidence === 'LOW';

  const handleCopyPhone = async () => {
    if (lead.phone) { await navigator.clipboard.writeText(lead.phone); toast.success('Phone copied!'); }
    else toast.info('No phone on file');
  };

  let borderColor = '#6b7280', bannerBg = '#6b7280', bannerText = '';
  if (isAlreadyInSystem) {
    bannerText = `✗ Already in System — ${lead.duplicate_notes || 'Existing record found'}`;
  } else if (isFlagged) {
    borderColor = '#d97706'; bannerBg = '#d97706';
    bannerText = '⚠ Possible Duplicate — Review Before Contacting';
  } else if (isBooked) {
    borderColor = '#16a34a'; bannerBg = '#16a34a'; bannerText = '✓ Booked';
  } else if (isContacted) {
    bannerText = '✓ Contacted';
  } else {
    const s = getSpeedInfo(lead.created_at);
    borderColor = s.color; bannerBg = s.color; bannerText = s.text;
  }

  return (
    <div className="rounded-lg overflow-hidden bg-card" style={{ border: `2px solid ${borderColor}` }}>
      <StatusBanner bgColor={bannerBg} text={bannerText} />
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-[15px]">{lead.first_name} {lead.last_name}</p>
              {hasLowFlag && <span title={lead.duplicate_notes || 'Possible name match'}><Info className="w-3.5 h-3.5 text-muted-foreground" /></span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{lead.source}</Badge>
              {lead.phone
                ? <span className="text-[11px] text-muted-foreground">{lead.phone}</span>
                : <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Phone missing</Badge>}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAlreadyInSystem ? (
                <DropdownMenuItem onClick={() => onAction(lead.id, 'move_to_new')}><RotateCcw className="w-3.5 h-3.5 mr-2" />Move back to New</DropdownMenuItem>
              ) : isFlagged ? (
                <>
                  <DropdownMenuItem onClick={() => onAction(lead.id, 'confirm_duplicate')} className="text-destructive"><Ban className="w-3.5 h-3.5 mr-2" />Confirm duplicate</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction(lead.id, 'confirm_not_duplicate')} className="text-success"><CheckCircle className="w-3.5 h-3.5 mr-2" />Not a duplicate</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onBook(lead)}><CalendarPlus className="w-3.5 h-3.5 mr-2" />Book Intro</DropdownMenuItem>
                </>
              ) : (
                <>
                  {!isContacted && !isBooked && <DropdownMenuItem onClick={() => onAction(lead.id, 'contacted')}><CheckCircle className="w-3.5 h-3.5 mr-2" />Mark Contacted</DropdownMenuItem>}
                  {!isBooked && <DropdownMenuItem onClick={() => onBook(lead)}><CalendarPlus className="w-3.5 h-3.5 mr-2" />Book Intro</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => onAction(lead.id, 'confirm_duplicate')} className="text-muted-foreground"><Ban className="w-3.5 h-3.5 mr-2" />Mark Already in System</DropdownMenuItem>
                  {(isContacted || isBooked) && <DropdownMenuItem onClick={() => onAction(lead.id, 'move_to_new')}><RotateCcw className="w-3.5 h-3.5 mr-2" />Move back to New</DropdownMenuItem>}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isFlagged && lead.duplicate_notes && (
          <div className="rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">⚠ {lead.duplicate_notes}</div>
        )}
        {isAlreadyInSystem && lead.duplicate_notes && (
          <div className="rounded bg-muted/60 border border-muted-foreground/20 px-2.5 py-1.5 text-[11px] text-muted-foreground">{lead.duplicate_notes}</div>
        )}

        {!isBooked && !isAlreadyInSystem && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isFlagged && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => onScript(lead)}>
                <MessageSquare className="w-3.5 h-3.5" /> Script
              </Button>
            )}
            {isFlagged ? (
              <>
                <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 border-destructive text-destructive" onClick={() => onAction(lead.id, 'confirm_duplicate')}>
                  <Ban className="w-3.5 h-3.5" /> Confirm duplicate
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 border-success text-success" onClick={() => onAction(lead.id, 'confirm_not_duplicate')}>
                  <CheckCircle className="w-3.5 h-3.5" /> Not a duplicate
                </Button>
              </>
            ) : (
              <>
                {!isContacted && <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={() => onBook(lead)}><CalendarPlus className="w-3.5 h-3.5" /> Book</Button>}
                {lead.phone && <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1" onClick={handleCopyPhone}><Copy className="w-3.5 h-3.5" /> Copy #</Button>}
                {!isContacted && <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] gap-1 text-muted-foreground" onClick={() => onAction(lead.id, 'contacted')}><CheckCircle className="w-3.5 h-3.5" /> Contacted</Button>}
              </>
            )}
          </div>
        )}
        {isBooked && <p className="text-[11px] text-muted-foreground">Intro booked — visible in Pipeline</p>}
      </div>
    </div>
  );
}

export function PipelineNewLeadsTab() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('new');
  const [bookLead, setBookLead] = useState<Lead | null>(null);
  const [scriptLead, setScriptLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .not('stage', 'in', '("lost")')
      .order('created_at', { ascending: false })
      .limit(300);
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleAction = async (leadId: string, action: LeadAction) => {
    let update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    switch (action) {
      case 'contacted': update.stage = 'contacted'; break;
      case 'move_to_new': update.stage = 'new'; update.duplicate_override = false; break;
      case 'confirm_duplicate': update.stage = 'already_in_system'; break;
      case 'confirm_not_duplicate':
        update.stage = 'new'; update.duplicate_override = true;
        update.duplicate_confidence = 'NONE'; update.duplicate_notes = null;
        toast.success('Lead confirmed as unique — will not be auto-flagged again');
        break;
    }
    await supabase.from('leads').update(update).eq('id', leadId);
    await supabase.from('lead_activities').insert({
      lead_id: leadId, activity_type: 'stage_change',
      performed_by: user?.name || 'Unknown', notes: `Action: ${action} (Pipeline)`,
    });
    fetchLeads();
  };

  const newLeads = leads.filter(l => l.stage === 'new');
  const flaggedLeads = leads.filter(l => l.stage === 'flagged');
  const contactedLeads = leads.filter(l => l.stage === 'contacted');
  const bookedLeads = leads.filter(l => l.stage === 'booked' || l.stage === 'won');
  const alreadyInSystem = leads.filter(l => l.stage === 'already_in_system');

  const scriptMergeContext = scriptLead ? {
    'first-name': scriptLead.first_name, 'last-name': scriptLead.last_name,
    'sa-name': user?.name || '', 'location-name': 'Tuscaloosa',
  } : {};

  const renderList = (list: Lead[], emptyLabel: string) => {
    if (loading) return <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>;
    if (list.length === 0) return <div className="text-center py-8 text-sm text-muted-foreground">No {emptyLabel} leads</div>;
    return (
      <div className="space-y-2.5">
        {list.map(lead => (
          <LeadCard key={lead.id} lead={lead} onAction={handleAction} onBook={setBookLead} onScript={setScriptLead} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="w-full flex h-auto gap-0.5 bg-muted/60 p-0.5 rounded-lg flex-wrap">
          {[
            { value: 'new', label: 'New', count: newLeads.length, variant: 'destructive' as const },
            { value: 'flagged', label: 'Flagged', count: flaggedLeads.length, variant: 'warning' as const },
            { value: 'contacted', label: 'Contacted', count: contactedLeads.length, variant: 'secondary' as const },
            { value: 'booked', label: 'Booked', count: bookedLeads.length, variant: 'secondary' as const },
            { value: 'system', label: 'In System', count: alreadyInSystem.length, variant: 'secondary' as const },
          ].map(({ value, label, count, variant }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex-1 text-[10px] py-1.5 flex items-center gap-1 justify-center rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              {value === 'flagged' && <AlertTriangle className="w-3 h-3" />}
              {label}
              {count > 0 && (
                <Badge
                  variant={variant === 'warning' ? 'secondary' : variant}
                  className={`h-3.5 px-1 text-[9px] min-w-[16px] ${value === 'flagged' ? 'bg-amber-500 text-white' : ''}`}
                >
                  {count}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="new" className="mt-2">
          {renderList([...newLeads].sort((a, b) => a.created_at.localeCompare(b.created_at)), 'new')}
        </TabsContent>
        <TabsContent value="flagged" className="mt-2">{renderList(flaggedLeads, 'flagged')}</TabsContent>
        <TabsContent value="contacted" className="mt-2">{renderList(contactedLeads, 'contacted')}</TabsContent>
        <TabsContent value="booked" className="mt-2">{renderList(bookedLeads, 'booked')}</TabsContent>
        <TabsContent value="system" className="mt-2">{renderList(alreadyInSystem, 'already-in-system')}</TabsContent>
      </Tabs>

      {bookLead && (
        <BookIntroDialog
          open={!!bookLead}
          onOpenChange={open => { if (!open) setBookLead(null); }}
          lead={bookLead}
          onDone={() => { setBookLead(null); fetchLeads(); }}
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
