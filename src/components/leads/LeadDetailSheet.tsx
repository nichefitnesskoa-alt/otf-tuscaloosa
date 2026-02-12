import { Tables } from '@/integrations/supabase/types';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, PhoneCall, MessageSquare, StickyNote, Clock, CalendarPlus, XCircle, Send, ShoppingBag, Trash2 } from 'lucide-react';
import { formatDistanceToNow, parseISO, format, differenceInDays } from 'date-fns';
import { useState } from 'react';
import { LogActionDialog } from './LogActionDialog';
import { MarkLostDialog } from './MarkLostDialog';
import { BookIntroDialog } from './BookIntroDialog';
import { ScheduleFollowUpDialog } from './ScheduleFollowUpDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';
import { SequenceTracker } from '@/components/scripts/SequenceTracker';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface LeadDetailSheetProps {
  lead: Tables<'leads'> | null;
  activities: Tables<'lead_activities'>[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-info text-info-foreground',
  contacted: 'bg-warning text-warning-foreground',
  won: 'bg-amber-500 text-white',
  lost: 'bg-muted text-muted-foreground',
};

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  won: 'Purchased',
  lost: 'Do Not Contact',
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call: <PhoneCall className="w-3.5 h-3.5" />,
  text: <MessageSquare className="w-3.5 h-3.5" />,
  note: <StickyNote className="w-3.5 h-3.5" />,
  reminder: <Clock className="w-3.5 h-3.5" />,
  stage_change: <CalendarPlus className="w-3.5 h-3.5" />,
  duplicate_detected: <XCircle className="w-3.5 h-3.5" />,
};

export function LeadDetailSheet({ lead, activities, open, onOpenChange, onRefresh }: LeadDetailSheetProps) {
  const { user } = useAuth();
  const [logAction, setLogAction] = useState<'call' | 'text' | 'note' | null>(null);
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [markingPurchased, setMarkingPurchased] = useState(false);

  const handleMarkPurchased = async () => {
    setMarkingPurchased(true);
    try {
      await supabase.from('leads').update({ stage: 'won' }).eq('id', lead!.id);
      await supabase.from('lead_activities').insert({
        lead_id: lead!.id,
        activity_type: 'stage_change',
        performed_by: user?.name || 'Unknown',
        notes: 'Marked as Purchased',
      });
      toast.success('Lead marked as Purchased');
      onRefresh();
    } catch {
      toast.error('Failed to update');
    } finally {
      setMarkingPurchased(false);
    }
  };

  const handleDeleteLead = async () => {
    setDeleting(true);
    try {
      await supabase.from('lead_activities').delete().eq('lead_id', lead!.id);
      await supabase.from('leads').delete().eq('id', lead!.id);
      toast.success('Lead deleted');
      onOpenChange(false);
      onRefresh();
    } catch {
      toast.error('Failed to delete lead');
    } finally {
      setDeleting(false);
    }
  };

  if (!lead) return null;

  const leadActivities = activities
    .filter(a => a.lead_id === lead.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const isBooked = !!lead.booked_intro_id;

  // Determine script categories based on lead stage/age/source
  const leadAgeDays = differenceInDays(new Date(), parseISO(lead.created_at));
  const scriptCategories: string[] = [];
  
  // Source-based suggestions
  if (lead.source.toLowerCase().includes('instagram')) {
    scriptCategories.push('ig_dm');
  } else if (lead.source.toLowerCase().includes('cold lead')) {
    scriptCategories.push('cold_lead');
  }
  
  scriptCategories.push('web_lead');
  
  // Add cold lead if old enough
  if (leadAgeDays > 30 && !scriptCategories.includes('cold_lead')) {
    scriptCategories.push('cold_lead');
  }
  
  // If booked, suggest booking confirmation
  if (isBooked) {
    scriptCategories.unshift('booking_confirmation');
  }

  const scriptMergeContext = {
    'first-name': lead.first_name,
    'last-name': lead.last_name,
    'sa-name': user?.name,
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg">
              {lead.first_name} {lead.last_name}
            </DrawerTitle>
          </DrawerHeader>

          <ScrollArea className="px-4 pb-6 flex-1">
            {/* Header info */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={STAGE_COLORS[lead.stage] || ''}>{STAGE_LABELS[lead.stage] || lead.stage}</Badge>
                {isBooked && <Badge className="bg-success text-success-foreground">Booked</Badge>}
                <span className="text-xs text-muted-foreground">{lead.source}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-primary">
                  <Phone className="w-4 h-4" />{lead.phone}
                </a>
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-primary">
                    <Mail className="w-4 h-4" />{lead.email}
                  </a>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Received {formatDistanceToNow(parseISO(lead.created_at), { addSuffix: true })}
              </p>
            </div>

            {/* Quick actions */}
            {!isBooked && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                <Button size="sm" variant="outline" onClick={() => setLogAction('call')} className="text-xs">
                  <PhoneCall className="w-3.5 h-3.5 mr-1" /> Call
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLogAction('text')} className="text-xs">
                  <MessageSquare className="w-3.5 h-3.5 mr-1" /> Text
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLogAction('note')} className="text-xs">
                  <StickyNote className="w-3.5 h-3.5 mr-1" /> Note
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowFollowUpDialog(true)} className="text-xs">
                  <Clock className="w-3.5 h-3.5 mr-1" /> Follow-Up
                </Button>
                <Button size="sm" variant="default" onClick={() => setShowBookDialog(true)} className="text-xs">
                  <CalendarPlus className="w-3.5 h-3.5 mr-1" /> Book
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowScripts(true)} className="text-xs">
                  <Send className="w-3.5 h-3.5 mr-1" /> Script
                </Button>
                {lead.stage !== 'lost' && lead.stage !== 'won' && (
                  <Button size="sm" variant="destructive" onClick={() => setShowLostDialog(true)} className="text-xs">
                    <XCircle className="w-3.5 h-3.5 mr-1" /> DNC
                  </Button>
                )}
                {lead.stage !== 'won' && (
                  <Button size="sm" className="text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={handleMarkPurchased} disabled={markingPurchased}>
                    <ShoppingBag className="w-3.5 h-3.5 mr-1" /> Purchased
                  </Button>
                )}
              </div>
            )}

            {/* Sequence Tracker */}
            {scriptCategories.includes('web_lead') && (
              <div className="mb-4">
                <SequenceTracker leadId={lead.id} category="web_lead" />
              </div>
            )}

            {/* Activity Timeline */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Activity Timeline</h4>
              {leadActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {leadActivities.map(a => (
                    <div key={a.id} className="flex gap-2 text-sm">
                      <div className="mt-0.5 text-muted-foreground">
                        {ACTIVITY_ICONS[a.activity_type] || <StickyNote className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{a.activity_type.replace('_', ' ')}</span>
                          <span className="text-xs text-muted-foreground">by {a.performed_by}</span>
                        </div>
                        {a.notes && <p className="text-muted-foreground text-xs mt-0.5">{a.notes}</p>}
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {format(parseISO(a.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delete Lead */}
            <div className="mt-6 pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Lead
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove {lead.first_name} {lead.last_name} and all their activity history. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteLead} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {logAction && (
        <LogActionDialog
          open={!!logAction}
          onOpenChange={() => setLogAction(null)}
          leadId={lead.id}
          leadStage={lead.stage}
          actionType={logAction}
          onDone={onRefresh}
        />
      )}
      <MarkLostDialog open={showLostDialog} onOpenChange={setShowLostDialog} leadId={lead.id} onDone={onRefresh} />
      <BookIntroDialog open={showBookDialog} onOpenChange={setShowBookDialog} lead={lead} onDone={onRefresh} />
      <ScheduleFollowUpDialog open={showFollowUpDialog} onOpenChange={setShowFollowUpDialog} leadId={lead.id} onDone={onRefresh} />
      <ScriptPickerSheet
        open={showScripts}
        onOpenChange={setShowScripts}
        suggestedCategories={scriptCategories}
        mergeContext={scriptMergeContext}
        leadId={lead.id}
        onLogged={onRefresh}
      />
    </>
  );
}
