import { Tables } from '@/integrations/supabase/types';
import { formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';
import { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadActionBar } from '@/components/ActionBar';
import { LeadSourceTag } from '@/components/dashboard/IntroTypeBadge';
import { formatPhoneDisplay } from '@/lib/parsing/phone';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface LeadListViewProps {
  leads: Tables<'leads'>[];
  activities: Tables<'lead_activities'>[];
  onLeadClick: (lead: Tables<'leads'>) => void;
  onStageChange: (leadId: string, newStage: string) => void;
  onBookIntro?: (lead: Tables<'leads'>) => void;
  onMarkAlreadyBooked?: (leadId: string) => void;
  onRefresh?: () => void;
}

type SortKey = 'name' | 'phone' | 'email' | 'stage' | 'created_at' | 'last_action' | 'days_since' | 'attempts';

export function LeadListView({ leads, activities, onLeadClick, onStageChange, onBookIntro, onMarkAlreadyBooked, onRefresh }: LeadListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activeLeads = leads.filter(l => !l.booked_intro_id && l.stage !== 'booked' && l.stage !== 'won');

  const enriched = useMemo(() => {
    return activeLeads.map(lead => {
      const leadActivities = activities.filter(a => a.lead_id === lead.id);
      const attempts = leadActivities.filter(a => ['call', 'text'].includes(a.activity_type)).length;
      const lastActivity = leadActivities.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const lastContactActivity = leadActivities
        .filter(a => ['call', 'text'].includes(a.activity_type))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const daysSinceContact = lastContactActivity
        ? differenceInDays(new Date(), parseISO(lastContactActivity.created_at))
        : null;
      const lastAnyDate = lastActivity ? parseISO(lastActivity.created_at) : parseISO(lead.created_at);
      const daysSinceAny = differenceInDays(new Date(), lastAnyDate);
      const isStale = (lead.stage === 'new' || lead.stage === 'contacted') && daysSinceAny >= 7 && daysSinceAny < 14;
      const isGoingCold = (lead.stage === 'new' || lead.stage === 'contacted') && daysSinceAny >= 14;
      return { lead, attempts, lastActivity, daysSinceContact, isStale, isGoingCold };
    });
  }, [activeLeads, activities]);

  const sorted = useMemo(() => {
    const arr = [...enriched];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = `${a.lead.first_name} ${a.lead.last_name}`.localeCompare(`${b.lead.first_name} ${b.lead.last_name}`); break;
        case 'phone': cmp = a.lead.phone.localeCompare(b.lead.phone); break;
        case 'email': cmp = (a.lead.email || '').localeCompare(b.lead.email || ''); break;
        case 'stage': cmp = a.lead.stage.localeCompare(b.lead.stage); break;
        case 'created_at': cmp = a.lead.created_at.localeCompare(b.lead.created_at); break;
        case 'last_action': cmp = (a.lastActivity?.created_at || '').localeCompare(b.lastActivity?.created_at || ''); break;
        case 'days_since': cmp = (a.daysSinceContact ?? 999) - (b.daysSinceContact ?? 999); break;
        case 'attempts': cmp = a.attempts - b.attempts; break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [enriched, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map(s => s.lead.id)));
    }
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      // Also delete related activities
      const ids = Array.from(selectedIds);
      await supabase.from('lead_activities').delete().in('lead_id', ids);
      const { error } = await supabase.from('leads').delete().in('id', ids);
      if (error) throw error;
      toast.success(`Permanently deleted ${ids.length} lead${ids.length !== 1 ? 's' : ''}`);
      setSelectedIds(new Set());
      setSelectMode(false);
      onRefresh?.();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(k)}>
      <span className="flex items-center gap-1">{label}<ArrowUpDown className="w-3 h-3" /></span>
    </TableHead>
  );

  return (
    <div className="space-y-2">
      {/* Select mode toolbar */}
      <div className="flex items-center gap-2">
        <Button
          variant={selectMode ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
        >
          {selectMode ? 'Cancel Select' : 'Select'}
        </Button>
        {selectMode && selectedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="w-3 h-3" />
            Delete {selectedIds.size} Selected
          </Button>
        )}
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectMode && (
                <TableHead className="w-8">
                  <Checkbox
                    checked={sorted.length > 0 && selectedIds.size === sorted.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <SortHeader label="Name" k="name" />
              <SortHeader label="Phone" k="phone" />
              <TableHead>Stage</TableHead>
              <SortHeader label="Received" k="created_at" />
              <SortHeader label="Last Action" k="last_action" />
              <SortHeader label="Days Since" k="days_since" />
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(({ lead, attempts, lastActivity, daysSinceContact, isStale, isGoingCold }) => (
              <TableRow
                key={lead.id}
                className={cn('cursor-pointer hover:bg-muted/50', lead.stage === 'lost' && 'opacity-50')}
              >
                {selectMode && (
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {lead.first_name} {lead.last_name}
                    {isGoingCold && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Going Cold</Badge>
                    )}
                    {isStale && !isGoingCold && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-warning text-warning">Stale</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="hover:text-primary">
                    {formatPhoneDisplay(lead.phone) || lead.phone}
                  </a>
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <Select value={lead.stage} onValueChange={v => onStageChange(lead.id, v)}>
                    <SelectTrigger className="h-7 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="booked">Booked</SelectItem>
                      <SelectItem value="won">Purchased</SelectItem>
                      <SelectItem value="lost">Do Not Contact</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(parseISO(lead.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {lastActivity
                    ? `${lastActivity.activity_type} — ${formatDistanceToNow(parseISO(lastActivity.created_at), { addSuffix: true })}`
                    : '—'}
                </TableCell>
                <TableCell className="text-center">{daysSinceContact ?? '—'}</TableCell>
                <TableCell>
                  <LeadActionBar
                    leadId={lead.id}
                    firstName={lead.first_name}
                    lastName={lead.last_name}
                    phone={lead.phone}
                    source={lead.source}
                    stage={lead.stage}
                    onOpenDetail={() => onLeadClick(lead)}
                    onBookIntro={onBookIntro ? () => onBookIntro(lead) : () => onLeadClick(lead)}
                    onMarkContacted={lead.stage === 'new' ? () => onStageChange(lead.id, 'contacted') : undefined}
                    onMarkAlreadyBooked={onMarkAlreadyBooked ? () => onMarkAlreadyBooked(lead.id) : undefined}
                  />
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={selectMode ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  No leads yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {selectedIds.size} lead{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All selected leads and their activity history will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
