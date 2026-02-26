/**
 * Spreadsheet/table view for Pipeline tabs.
 * Each tab renders its own column set. Rows are sortable and expandable inline.
 * Uses @tanstack/react-virtual for performance with large datasets.
 */
import { useRef, useState, useMemo, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight, Copy, Phone, FileText, Edit, Plus, CalendarPlus, MoreVertical, UserCheck, DollarSign, UserX, Archive, Trash2, Link, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { isMembershipSale } from '@/lib/sales-detection';
import { isVipBooking } from '@/lib/vip/vipRules';
import { PipelineScriptPicker } from '@/components/dashboard/PipelineScriptPicker';
import { ConvertVipToIntroDialog } from '@/components/vip/ConvertVipToIntroDialog';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { formatPhoneDisplay, stripCountryCode } from '@/lib/parsing/phone';
import type { ClientJourney, PipelineBooking, PipelineRun, JourneyTab, VipInfo } from '../pipelineTypes';

interface PipelineSpreadsheetProps {
  journeys: ClientJourney[];
  vipGroups: [string, ClientJourney[]][] | null;
  vipInfoMap: Map<string, VipInfo>;
  isLoading: boolean;
  activeTab: JourneyTab;
  isOnline: boolean;
  onOpenDialog: (type: string, data?: any) => void;
  onRefresh: () => Promise<void>;
}

type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
}

// ── Helpers ──

function getLatestBooking(j: ClientJourney): PipelineBooking | null {
  return j.bookings.find(b =>
    b.booking_status_canon === 'ACTIVE' || !b.booking_status || b.booking_status === 'Active'
  ) || j.bookings[0] || null;
}

function getLatestRun(j: ClientJourney): PipelineRun | null {
  return j.runs.find(r => r.result !== 'No-show') || j.runs[0] || null;
}

function getQStatus(j: ClientJourney): 'complete' | 'not_answered' | 'not_sent' {
  const b = getLatestBooking(j);
  if (!b) return 'not_sent';
  const canon = (b as any).questionnaire_status_canon;
  if (canon === 'submitted') return 'complete';
  if (canon === 'sent' || canon === 'opened') return 'not_answered';
  return 'not_sent';
}

function QStatusPill({ status }: { status: 'complete' | 'not_answered' | 'not_sent' }) {
  if (status === 'complete') return <Badge className="bg-green-600 text-white text-[10px] px-1.5">Complete</Badge>;
  if (status === 'not_answered') return <Badge className="bg-amber-500 text-white text-[10px] px-1.5">Not Answered</Badge>;
  return <Badge className="bg-red-600 text-white text-[10px] px-1.5">Not Sent</Badge>;
}

function OutcomeBadge({ result }: { result: string }) {
  if (isMembershipSale(result)) return <Badge className="bg-green-600 text-white text-[10px]">Sold</Badge>;
  if (result === 'No-show') return <Badge variant="destructive" className="text-[10px]">No Show</Badge>;
  if (result === "Didn't Buy" || result === 'Follow-up needed') return <Badge className="bg-amber-500 text-white text-[10px]">Follow-up</Badge>;
  if (result === 'Follow-up needed' || result === 'Booked 2nd intro') return <Badge className="bg-blue-600 text-white text-[10px]">Follow-up</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{result}</Badge>;
}

// ── Column definitions per tab ──

function getColumns(tab: JourneyTab): ColumnDef[] {
  switch (tab) {
    case 'upcoming':
      return [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'class_date', label: 'Class Date', sortable: true },
        { key: 'class_time', label: 'Class Time', sortable: true },
        { key: 'coach', label: 'Coach', sortable: true },
        { key: 'lead_source', label: 'Lead Source', sortable: true },
        { key: 'q_status', label: 'Q Status', sortable: true },
        { key: 'sa', label: 'SA', sortable: true },
        { key: 'actions', label: 'Actions' },
      ];
    case 'today':
      return [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'class_time', label: 'Class Time', sortable: true },
        { key: 'coach', label: 'Coach', sortable: true },
        { key: 'lead_source', label: 'Lead Source', sortable: true },
        { key: 'q_status', label: 'Q Status', sortable: true },
        { key: 'prepped', label: 'Prepped', sortable: true },
        { key: 'sa', label: 'SA', sortable: true },
        { key: 'actions', label: 'Actions' },
      ];
    case 'completed':
      return [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'class_date', label: 'Class Date', sortable: true },
        { key: 'outcome', label: 'Outcome', sortable: true },
        { key: 'membership', label: 'Membership', sortable: true },
        { key: 'commission', label: 'Commission', sortable: true },
        { key: 'sa', label: 'SA', sortable: true },
        { key: 'coach', label: 'Coach', sortable: true },
        { key: 'actions', label: 'Actions' },
      ];
    case 'no_show':
      return [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'class_date', label: 'Class Date', sortable: true },
        { key: 'class_time', label: 'Class Time', sortable: true },
        { key: 'coach', label: 'Coach', sortable: true },
        { key: 'sa', label: 'SA', sortable: true },
        { key: 'touch', label: 'Touch', sortable: true },
        { key: 'last_contact', label: 'Last Contact', sortable: true },
        { key: 'actions', label: 'Actions' },
      ];
    case 'missed_guest':
      return [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'class_date', label: 'Class Date', sortable: true },
        { key: 'sa', label: 'SA', sortable: true },
        { key: 'phone', label: 'Phone', sortable: true },
        { key: 'lead_source', label: 'Lead Source', sortable: true },
        { key: 'actions', label: 'Actions' },
      ];
    case 'second_intro':
      return [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'original_date', label: 'Original Date', sortable: true },
        { key: 'second_date', label: '2nd Date', sortable: true },
        { key: 'coach', label: 'Coach', sortable: true },
        { key: 'sa', label: 'SA', sortable: true },
        { key: 'q_status', label: 'Q Status', sortable: true },
        { key: 'actions', label: 'Actions' },
      ];
    case 'not_interested':
      return [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'class_date', label: 'Class Date', sortable: true },
        { key: 'objection', label: 'Objection', sortable: true },
        { key: 'sa', label: 'SA', sortable: true },
        { key: 'notes', label: 'Notes', sortable: false },
        { key: 'actions', label: 'Actions' },
      ];
    case 'by_lead_source':
      return [
        { key: 'source', label: 'Source', sortable: true },
        { key: 'total_booked', label: 'Total Booked', sortable: true },
        { key: 'showed', label: 'Showed', sortable: true },
        { key: 'sold', label: 'Sold', sortable: true },
        { key: 'close_rate', label: 'Close Rate', sortable: true },
        { key: 'no_show_rate', label: 'No Show Rate', sortable: true },
      ];
    default: // 'all'
      return [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'created_at', label: 'Created', sortable: true },
        { key: 'class_date', label: 'Class Date', sortable: true },
        { key: 'class_time', label: 'Class Time', sortable: true },
        { key: 'coach', label: 'Coach', sortable: true },
        { key: 'lead_source', label: 'Lead Source', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'sa', label: 'SA', sortable: true },
        { key: 'actions', label: 'Actions' },
      ];
  }
}

// ── Default sort per tab ──

function getDefaultSort(tab: JourneyTab): { key: string; dir: SortDir } {
  switch (tab) {
    case 'upcoming': return { key: 'class_date', dir: 'asc' };
    case 'today': return { key: 'class_time', dir: 'asc' };
    case 'second_intro': return { key: 'second_date', dir: 'asc' };
    default: return { key: 'created_at', dir: 'desc' };
  }
}

// ── Extract sortable value from journey ──

function getSortValue(j: ClientJourney, key: string): string | number | boolean {
  const b = getLatestBooking(j);
  const r = getLatestRun(j);
  switch (key) {
    case 'name': return j.memberName.toLowerCase();
    case 'created_at': return b?.created_at || '';
    case 'class_date': return b?.class_date || '';
    case 'class_time': return b?.intro_time || '';
    case 'coach': return b?.coach_name || '';
    case 'lead_source': return b?.lead_source || '';
    case 'sa': return j.latestIntroOwner || b?.sa_working_shift || '';
    case 'q_status': return getQStatus(j);
    case 'prepped': return b ? (b as any).prepped === true : false;
    case 'outcome': return r?.result || '';
    case 'membership': return r ? (isMembershipSale(r.result) ? r.result : '') : '';
    case 'commission': return r?.commission_amount || 0;
    case 'touch': return 0; // placeholder
    case 'last_contact': return '';
    case 'phone': return b?.phone || '';
    case 'status': return j.status;
    case 'objection': return r?.notes || '';
    case 'notes': return r?.notes || '';
    case 'original_date': {
      const orig = j.bookings.find(bk => bk.originating_booking_id);
      const origBooking = orig ? j.bookings.find(bk => bk.id === orig.originating_booking_id) : j.bookings[j.bookings.length - 1];
      return origBooking?.class_date || '';
    }
    case 'second_date': {
      const second = j.bookings.find(bk => bk.originating_booking_id) || j.bookings[0];
      return second?.class_date || '';
    }
    default: return '';
  }
}

// ── Main component ──

export function PipelineSpreadsheet({
  journeys, vipGroups, vipInfoMap, isLoading, activeTab, isOnline, onOpenDialog, onRefresh,
}: PipelineSpreadsheetProps) {
  const { user } = useAuth();
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>(getDefaultSort(activeTab).key);
  const [sortDir, setSortDir] = useState<SortDir>(getDefaultSort(activeTab).dir);
  const [scriptJourney, setScriptJourney] = useState<ClientJourney | null>(null);

  // Reset sort when tab changes
  const columns = useMemo(() => getColumns(activeTab), [activeTab]);

  const toggleSort = useCallback((key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(getDefaultSort(activeTab).dir); }
  }, [sortKey, activeTab]);

  const sorted = useMemo(() => {
    const arr = [...journeys];
    arr.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else if (typeof va === 'boolean' && typeof vb === 'boolean') cmp = (va === vb ? 0 : va ? -1 : 1);
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [journeys, sortKey, sortDir]);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => expandedKey === sorted[i]?.memberKey ? 300 : 40,
    overscan: 15,
  });

  // By Source: analytics summary view
  if (activeTab === 'by_lead_source') {
    return <BySourceTable journeys={journeys} isLoading={isLoading} onOpenDialog={onOpenDialog} isOnline={isOnline} vipInfoMap={vipInfoMap} />;
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (sorted.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-8">No clients match current filters</div>;
  }

  return (
    <>
      <div ref={parentRef} className="h-[600px] overflow-auto rounded-lg border">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b flex min-w-[800px]">
          {columns.map(col => (
            <div
              key={col.key}
              className={`px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-1 flex-shrink-0 ${
                col.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''
              } ${col.key === 'name' ? 'w-[180px]' : col.key === 'actions' ? 'w-[140px]' : col.key === 'notes' ? 'w-[200px]' : 'w-[120px]'}`}
              onClick={() => col.sortable && toggleSort(col.key)}
            >
              {col.label}
              {col.sortable && sortKey === col.key && (
                sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
              )}
              {col.sortable && sortKey !== col.key && <ArrowUpDown className="w-3 h-3 opacity-30" />}
            </div>
          ))}
        </div>

        {/* Virtualized rows */}
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative', minWidth: '800px' }}>
          {virtualizer.getVirtualItems().map(vRow => {
            const journey = sorted[vRow.index];
            const isExpanded = expandedKey === journey.memberKey;
            return (
              <div
                key={journey.memberKey}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vRow.start}px)`,
                }}
                ref={virtualizer.measureElement}
                data-index={vRow.index}
              >
                <SpreadsheetRow
                  journey={journey}
                  columns={columns}
                  activeTab={activeTab}
                  isExpanded={isExpanded}
                  isOnline={isOnline}
                  vipInfoMap={vipInfoMap}
                  onToggle={() => setExpandedKey(isExpanded ? null : journey.memberKey)}
                  onOpenDialog={onOpenDialog}
                  onOpenScript={() => setScriptJourney(journey)}
                  isEven={vRow.index % 2 === 0}
                  userName={user?.name || 'Admin'}
                />
              </div>
            );
          })}
        </div>
      </div>

      {scriptJourney && (
        <PipelineScriptPicker
          journey={scriptJourney as any}
          open={!!scriptJourney}
          onOpenChange={(open) => { if (!open) setScriptJourney(null); }}
        />
      )}
    </>
  );
}

// ── Individual Row ──

interface SpreadsheetRowProps {
  journey: ClientJourney;
  columns: ColumnDef[];
  activeTab: JourneyTab;
  isExpanded: boolean;
  isOnline: boolean;
  vipInfoMap: Map<string, VipInfo>;
  onToggle: () => void;
  onOpenDialog: (type: string, data?: any) => void;
  onOpenScript: () => void;
  isEven: boolean;
  userName: string;
}

const SpreadsheetRow = memo(function SpreadsheetRow({
  journey, columns, activeTab, isExpanded, isOnline, vipInfoMap,
  onToggle, onOpenDialog, onOpenScript, isEven, userName,
}: SpreadsheetRowProps) {
  const b = getLatestBooking(journey);
  const r = getLatestRun(journey);
  const rawPhone = b?.phone || (b as any)?.phone_e164 || journey.bookings.find(bk => bk.phone)?.phone || null;
  const phone = rawPhone || null;

  const copyPhone = () => {
    if (phone) { navigator.clipboard.writeText(stripCountryCode(phone) || phone); toast.success('Phone copied'); }
  };

  const handlePreppedToggle = async () => {
    if (!b) return;
    const newVal = !(b as any).prepped;
    const { error } = await supabase.from('intros_booked').update({
      prepped: newVal,
      prepped_at: newVal ? new Date().toISOString() : null,
      prepped_by: newVal ? userName : null,
    }).eq('id', b.id);
    if (error) toast.error('Failed to update prep status');
    else { toast.success(newVal ? 'Marked as prepped' : 'Unmarked'); onOpenDialog('refresh', {}); }
  };

  const renderCell = (col: ColumnDef) => {
    switch (col.key) {
      case 'name':
        return (
          <div className="flex items-center gap-1.5 truncate">
            {isExpanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
            <span className="font-medium truncate">{journey.memberName}</span>
          </div>
        );
      case 'created_at': return <span className="text-xs text-muted-foreground">{b?.created_at ? formatDistanceToNow(parseISO(b.created_at), { addSuffix: true }) : '—'}</span>;
      case 'class_date': return <span className="text-xs">{b?.class_date || '—'}</span>;
      case 'class_time': return <span className="text-xs">{b?.intro_time || '—'}</span>;
      case 'coach': return <span className="text-xs truncate">{b?.coach_name || '—'}</span>;
      case 'lead_source': return <span className="text-xs truncate">{b?.lead_source || '—'}</span>;
      case 'sa': return <span className="text-xs truncate">{journey.latestIntroOwner || b?.sa_working_shift || '—'}</span>;
      case 'q_status': return <QStatusPill status={getQStatus(journey)} />;
      case 'prepped':
        return (
          <div onClick={e => e.stopPropagation()}>
            <Checkbox checked={(b as any)?.prepped === true} onCheckedChange={handlePreppedToggle} />
          </div>
        );
      case 'outcome': return r ? <OutcomeBadge result={r.result} /> : <span className="text-xs text-muted-foreground">—</span>;
      case 'membership': return r && isMembershipSale(r.result) ? <span className="text-xs">{r.result}</span> : <span className="text-xs">—</span>;
      case 'commission': return r && (r.commission_amount || 0) > 0 ? <span className="text-xs text-green-600 font-medium">${r.commission_amount}</span> : <span className="text-xs">—</span>;
      case 'status': {
        const s = journey.status;
        if (s === 'purchased') return <Badge className="bg-green-600 text-white text-[10px]">Purchased</Badge>;
        if (s === 'not_interested') return <Badge variant="secondary" className="text-[10px]">Not Interested</Badge>;
        if (s === 'no_show') return <Badge variant="destructive" className="text-[10px]">No-show</Badge>;
        if (s === 'active') return <Badge variant="outline" className="text-[10px]">Active</Badge>;
        return <Badge variant="secondary" className="text-[10px]">Unknown</Badge>;
      }
      case 'phone':
        return phone ? (
          <button className="text-xs hover:text-primary flex items-center gap-0.5" onClick={e => { e.stopPropagation(); copyPhone(); }}>
            <Copy className="w-3 h-3" /> {formatPhoneDisplay(phone) || phone}
          </button>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      case 'touch': return <span className="text-xs">—</span>;
      case 'last_contact': return <span className="text-xs">—</span>;
      case 'objection': return <span className="text-xs truncate">{r?.notes || '—'}</span>;
      case 'notes': return <span className="text-xs truncate max-w-[180px] block">{r?.notes || '—'}</span>;
      case 'original_date': {
        const origBooking = journey.bookings[journey.bookings.length - 1];
        return <span className="text-xs">{origBooking?.class_date || '—'}</span>;
      }
      case 'second_date': {
        const second = journey.bookings.find(bk => bk.originating_booking_id) || journey.bookings[0];
        return <span className="text-xs">{second?.class_date || '—'}</span>;
      }
      case 'actions':
        return (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {(activeTab === 'upcoming' || activeTab === 'today' || activeTab === 'second_intro' || activeTab === 'all') && (
              <>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                  onClick={() => onOpenDialog('prep', { booking: b, journey })}>
                  Prep
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                  onClick={onOpenScript}>
                  Script
                </Button>
              </>
            )}
            {(activeTab === 'completed') && (
              <>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                  onClick={() => { if (!isOnline) { toast.error('Requires internet'); return; } onOpenDialog('edit_run', { run: r, journey }); }}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                  onClick={onOpenScript}>
                  Script
                </Button>
              </>
            )}
            {(activeTab === 'no_show' || activeTab === 'missed_guest') && (
              <>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                  onClick={onOpenScript}>
                  Script
                </Button>
                {phone && (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                    onClick={copyPhone}>
                    Copy #
                  </Button>
                )}
              </>
            )}
            {activeTab === 'not_interested' && (
              <>
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                  onClick={onOpenScript}>
                  Script
                </Button>
                {phone && (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]"
                    onClick={copyPhone}>
                    Copy #
                  </Button>
                )}
              </>
            )}
          </div>
        );
      default: return null;
    }
  };

  return (
    <div>
      {/* Main row */}
      <div
        className={`flex items-center cursor-pointer transition-colors border-b min-w-[800px] ${
          isEven ? 'bg-background' : 'bg-muted/30'
        } hover:bg-muted/60 ${isExpanded ? 'bg-primary/5' : ''}`}
        onClick={onToggle}
      >
        {columns.map(col => (
          <div
            key={col.key}
            className={`px-3 py-2 flex items-center flex-shrink-0 ${
              col.key === 'name' ? 'w-[180px]' : col.key === 'actions' ? 'w-[140px]' : col.key === 'notes' ? 'w-[200px]' : 'w-[120px]'
            }`}
          >
            {renderCell(col)}
          </div>
        ))}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <ExpandedRowDetail
          journey={journey}
          vipInfoMap={vipInfoMap}
          isOnline={isOnline}
          onOpenDialog={onOpenDialog}
          onOpenScript={onOpenScript}
          userName={userName}
        />
      )}
    </div>
  );
});

// ── Expanded Row Detail ──

function ExpandedRowDetail({
  journey, vipInfoMap, isOnline, onOpenDialog, onOpenScript, userName,
}: {
  journey: ClientJourney;
  vipInfoMap: Map<string, VipInfo>;
  isOnline: boolean;
  onOpenDialog: (type: string, data?: any) => void;
  onOpenScript: () => void;
  userName: string;
}) {
  const phone = journey.bookings.find(b => b.phone)?.phone;
  const email = journey.bookings.find(b => b.email)?.email;

  return (
    <div className="p-4 bg-muted/10 border-b border-l-4 border-l-primary/30 space-y-3 min-w-[800px]">
      {/* Contact info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {phone && (
          <button className="flex items-center gap-1 hover:text-foreground"
            onClick={() => { navigator.clipboard.writeText(phone); toast.success('Phone copied'); }}>
            <Phone className="w-3 h-3" /> {phone}
          </button>
        )}
        {email && <span className="truncate max-w-[200px]">✉️ {email}</span>}
        {journey.latestIntroOwner && <span>Owner: {journey.latestIntroOwner}</span>}
      </div>

      {/* Bookings */}
      {journey.bookings.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1">Bookings ({journey.bookings.length})</div>
          <div className="space-y-1">
            {journey.bookings.map(b => (
              <div key={b.id} className="text-xs p-2 bg-background rounded border flex justify-between items-start">
                <div>
                  <span className="font-medium">{b.class_date}</span>
                  {b.intro_time && <span className="text-muted-foreground"> @ {b.intro_time}</span>}
                  <span className="text-muted-foreground"> · {b.coach_name} · {b.lead_source}</span>
                  {b.originating_booking_id && <Badge variant="outline" className="text-[10px] ml-1">2nd</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={b.booking_status_canon === 'CLOSED_PURCHASED' ? 'default' : 'outline'}
                    className={b.booking_status_canon === 'CLOSED_PURCHASED' ? 'bg-green-600 text-white' : ''}>
                    {b.booking_status || 'Active'}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreVertical className="w-3 h-3" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenDialog('edit_booking', { booking: b })}><Edit className="w-3 h-3 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenDialog('set_owner', { booking: b })}><UserCheck className="w-3 h-3 mr-2" /> Set Owner</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenDialog('purchase', { booking: b })}><DollarSign className="w-3 h-3 mr-2" /> Purchased</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenDialog('not_interested', { booking: b })}><UserX className="w-3 h-3 mr-2" /> Not Interested</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onOpenDialog('hard_delete_booking', { booking: b })} className="text-destructive"><Trash2 className="w-3 h-3 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Runs */}
      {journey.runs.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-1">Intro Runs ({journey.runs.length})</div>
          <div className="space-y-1">
            {journey.runs.map(r => (
              <div key={r.id} className="text-xs p-2 bg-background rounded border flex justify-between items-start">
                <div>
                  <span className="font-medium">{r.run_date || 'No date'}</span>
                  <span className="text-muted-foreground"> @ {r.class_time} · Ran by: {r.ran_by || '—'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <OutcomeBadge result={r.result} />
                  {(r.commission_amount || 0) > 0 && <span className="text-green-600 font-medium">${r.commission_amount}</span>}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                    onClick={() => { if (!isOnline) { toast.error('Requires internet'); return; } onOpenDialog('edit_run', { run: r, journey }); }}>
                    <Edit className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="pt-2 border-t border-dashed flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenDialog('create_run', { journey })}>
          <Plus className="w-3 h-3 mr-1" /> Add Run
        </Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenDialog('log_2nd_intro', { journey })}>
          <CalendarPlus className="w-3 h-3 mr-1" /> 2nd Intro
        </Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={onOpenScript}>
          <FileText className="w-3 h-3 mr-1" /> Script
        </Button>
        {phone && (
          <Button variant="outline" size="sm" className="text-xs"
            onClick={() => window.open(`tel:${phone}`)}>
            <Phone className="w-3 h-3 mr-1" /> Call
          </Button>
        )}
      </div>
    </div>
  );
}

// ── By Source Analytics Table ──

function BySourceTable({
  journeys, isLoading, onOpenDialog, isOnline, vipInfoMap,
}: {
  journeys: ClientJourney[];
  isLoading: boolean;
  onOpenDialog: (type: string, data?: any) => void;
  isOnline: boolean;
  vipInfoMap: Map<string, VipInfo>;
}) {
  const [sortKey, setSortKey] = useState<string>('total_booked');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const sourceStats = useMemo(() => {
    const map = new Map<string, { source: string; journeys: ClientJourney[]; totalBooked: number; showed: number; sold: number }>();
    journeys.forEach(j => {
      const src = j.bookings[0]?.lead_source || 'Unknown';
      if (!map.has(src)) map.set(src, { source: src, journeys: [], totalBooked: 0, showed: 0, sold: 0 });
      const entry = map.get(src)!;
      entry.journeys.push(j);
      entry.totalBooked += j.bookings.length;
      if (j.runs.some(r => r.result !== 'No-show')) entry.showed++;
      if (j.hasSale) entry.sold++;
    });
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case 'total_booked': va = a.totalBooked; vb = b.totalBooked; break;
        case 'showed': va = a.showed; vb = b.showed; break;
        case 'sold': va = a.sold; vb = b.sold; break;
        case 'close_rate': va = a.showed ? a.sold / a.showed : 0; vb = b.showed ? b.sold / b.showed : 0; break;
        case 'no_show_rate': va = a.totalBooked ? (a.totalBooked - a.showed) / a.totalBooked : 0; vb = b.totalBooked ? (b.totalBooked - b.showed) / b.totalBooked : 0; break;
        default: va = a.source.localeCompare(b.source) as any; vb = 0; break;
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [journeys, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const cols = [
    { key: 'source', label: 'Source' },
    { key: 'total_booked', label: 'Total Booked' },
    { key: 'showed', label: 'Showed' },
    { key: 'sold', label: 'Sold' },
    { key: 'close_rate', label: 'Close Rate' },
    { key: 'no_show_rate', label: 'No Show Rate' },
  ];

  return (
    <div className="rounded-lg border overflow-x-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b flex">
        {cols.map(col => (
          <div key={col.key}
            className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground select-none w-[140px] flex-shrink-0"
            onClick={() => toggleSort(col.key)}>
            {col.label}
            {sortKey === col.key ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </div>
        ))}
      </div>

      {/* Rows */}
      {sourceStats.map((stat, i) => (
        <div key={stat.source}>
          <div
            className={`flex items-center cursor-pointer transition-colors border-b ${i % 2 === 0 ? 'bg-background' : 'bg-muted/30'} hover:bg-muted/60`}
            onClick={() => setExpandedSource(expandedSource === stat.source ? null : stat.source)}
          >
            <div className="px-3 py-2 w-[140px] flex-shrink-0 flex items-center gap-1 text-xs font-medium">
              {expandedSource === stat.source ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {stat.source}
            </div>
            <div className="px-3 py-2 w-[140px] flex-shrink-0 text-xs font-bold">{stat.totalBooked}</div>
            <div className="px-3 py-2 w-[140px] flex-shrink-0 text-xs">{stat.showed}</div>
            <div className="px-3 py-2 w-[140px] flex-shrink-0 text-xs text-green-600 font-medium">{stat.sold}</div>
            <div className="px-3 py-2 w-[140px] flex-shrink-0 text-xs">{stat.showed > 0 ? `${Math.round(stat.sold / stat.showed * 100)}%` : '—'}</div>
            <div className="px-3 py-2 w-[140px] flex-shrink-0 text-xs">{stat.totalBooked > 0 ? `${Math.round((stat.totalBooked - stat.showed) / stat.totalBooked * 100)}%` : '—'}</div>
          </div>

          {expandedSource === stat.source && (
            <div className="bg-muted/10 border-b border-l-4 border-l-primary/30 p-3 space-y-1">
              {stat.journeys.map(j => {
                const b = getLatestBooking(j);
                const r = getLatestRun(j);
                return (
                  <div key={j.memberKey} className="text-xs flex items-center gap-3 p-1.5 bg-background rounded border">
                    <span className="font-medium w-[150px] truncate">{j.memberName}</span>
                    <span className="text-muted-foreground w-[100px]">{b?.class_date || '—'}</span>
                    {r ? <OutcomeBadge result={r.result} /> : <span className="text-muted-foreground">No run</span>}
                    {(r?.commission_amount || 0) > 0 && <span className="text-green-600">${r?.commission_amount}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {sourceStats.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">No data</div>
      )}
    </div>
  );
}
