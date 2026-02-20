import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, RefreshCw, FileSpreadsheet, Database, Users, BarChart3, Megaphone, CalendarDays, BookOpen, Phone, ClipboardCheck, FileText, TrendingUp, SearchCheck } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getSpreadsheetId, setSpreadsheetId } from '@/lib/sheets-sync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PayPeriodCommission from '@/components/PayPeriodCommission';
import ShiftRecapsEditor from '@/components/admin/ShiftRecapsEditor';

// CoachPerformance removed from Overview - available in Coaching tab and Studio
import ReferralTracker from '@/components/admin/ReferralTracker';
import ReferralTree from '@/components/admin/ReferralTree';
import VipBulkImport from '@/components/admin/VipBulkImport';
import CoachingView from '@/components/admin/CoachingView';
import CampaignsPanel from '@/components/admin/CampaignsPanel';
import AmcLogForm from '@/components/admin/AmcLogForm';
import AdminOverviewHealth from '@/components/admin/AdminOverviewHealth';
import { IntegrityDashboard } from '@/components/admin/IntegrityDashboard';
import SuccessStoriesPanel from '@/components/admin/SuccessStoriesPanel';
import ScriptsPage from '@/pages/Scripts';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { getDateRangeForPreset, DatePreset, DateRange } from '@/lib/pay-period';
import { useMeetingAgenda, getCurrentMeetingMonday } from '@/hooks/useMeetingAgenda';
import { format, addDays } from 'date-fns';

const ALL_STAFF = ['Bre', 'Elizabeth', 'James', 'Nathan', 'Kaitlyn H', 'Natalya', 'Bri', 'Grace', 'Katie', 'Kailey', 'Kayla', 'Koa', 'Lauren', 'Nora', 'Sophie'];

function PhoneBackfillCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const handleBackfill = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc('backfill_booking_phones');
      if (error) throw error;
      const updated = (data as any)?.updated ?? 0;
      setResult(updated);
      toast.success(`Updated ${updated} row${updated !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err?.message || 'Backfill failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Phone Backfill
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Parse phone numbers from email intake events and write them to intros that are missing a phone number. Safe to run multiple times.
        </p>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleBackfill} disabled={running} variant="outline">
            {running ? 'Running…' : 'Backfill missing phones from email parsing'}
          </Button>
          {result !== null && (
            <span className="text-sm text-muted-foreground">Updated {result} rows</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionnaireReconcileCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const handleReconcile = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc('reconcile_questionnaire_statuses');
      if (error) throw error;
      const updated = (data as any)?.updated ?? 0;
      setResult(updated);
      toast.success(`Fixed ${updated} row${updated !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err?.message || 'Reconciliation failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" />
          Questionnaire Status Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Finds intros where the questionnaire was completed but the status wasn't updated. Safe to run multiple times.
        </p>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleReconcile} disabled={running} variant="outline">
            {running ? 'Running…' : 'Fix questionnaire statuses'}
          </Button>
          {result !== null && (
            <span className="text-sm text-muted-foreground">Fixed {result} rows</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionnaireSlugBackfillCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  const handleBackfill = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc('backfill_questionnaire_slugs' as any);
      if (error) throw error;
      const updated = (data as any)?.updated ?? 0;
      setResult(updated);
      toast.success(`Updated ${updated} row${updated !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err?.message || 'Backfill failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Questionnaire URL Slugs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Updates all questionnaire slugs to the new <code className="font-mono text-[10px]">firstname-lastname-uuid</code> format. Safe to run multiple times — skips rows already in the correct format.
        </p>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleBackfill} disabled={running} variant="outline">
            {running ? 'Running…' : 'Backfill questionnaire URL slugs'}
          </Button>
          {result !== null && (
            <span className="text-sm text-muted-foreground">Updated {result} rows</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DuplicateDetectionCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ flagged: number; moved: number } | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      // Include 'contacted' leads — they may have matched a booking that was created after they were contacted
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, phone, email, stage, duplicate_override')
        .in('stage', ['new', 'contacted', 'flagged'])
        .neq('duplicate_override', true);

      if (error) throw error;
      if (!leads || leads.length === 0) { toast.success('No leads to process'); setRunning(false); return; }

      const { runDeduplicationForLead } = await import('@/lib/leads/detectDuplicate');
      let flagged = 0, moved = 0;

      for (const lead of leads) {
        const r = await runDeduplicationForLead(lead.id, {
          first_name: lead.first_name,
          last_name: lead.last_name,
          phone: lead.phone,
          email: lead.email,
          stage: lead.stage,
          duplicate_override: lead.duplicate_override ?? false,
        });
        if (r.confidence === 'HIGH') moved++;
        else if (r.confidence === 'MEDIUM') flagged++;
      }

      setResult({ flagged, moved });
      toast.success(`Done — ${moved} moved to Already in System, ${flagged} flagged for review`);
    } catch (err: any) {
      toast.error(err?.message || 'Duplicate detection failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <SearchCheck className="w-4 h-4" />
          Duplicate Detection Backfill
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Runs deduplication on all active leads — checks phone, email, and name against existing bookings. HIGH confidence → moved to Already in System. MEDIUM → flagged for SA review.
        </p>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleRun} disabled={running} variant="outline">
            {running ? 'Running…' : 'Run duplicate detection on all leads'}
          </Button>
          {result !== null && (
            <span className="text-sm text-muted-foreground">
              Flagged {result.flagged} · Moved {result.moved} to Already in System
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyContactAvgCard() {
  const [rows, setRows] = useState<{ staff_name: string; days: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Current Mon–today
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun
      const diffToMon = (dayOfWeek + 6) % 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - diffToMon);
      mon.setHours(0, 0, 0, 0);
      const monStr = mon.toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      const { data } = await supabase
        .from('shift_recaps')
        .select('staff_name, shift_date, calls_made, texts_sent, dms_sent, emails_sent')
        .gte('shift_date', monStr)
        .lte('shift_date', todayStr);

      if (!data) { setLoading(false); return; }

      // Aggregate by staff — sum contacts, count distinct shift days
      const map: Record<string, { total: number; days: Set<string> }> = {};
      for (const r of data) {
        const key = r.staff_name;
        if (!map[key]) map[key] = { total: 0, days: new Set() };
        map[key].total += (r.calls_made || 0) + (r.texts_sent || 0) + (r.dms_sent || 0) + (r.emails_sent || 0);
        map[key].days.add(r.shift_date);
      }

      const result = Object.entries(map)
        .map(([staff_name, v]) => ({ staff_name, days: v.days.size, total: v.total }))
        .sort((a, b) => b.total / b.days - a.total / a.days);

      setRows(result);
      setLoading(false);
    };
    load();
  }, []);

  const daysElapsed = (() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    return dayOfWeek === 0 ? 7 : dayOfWeek; // Mon–Sun: days since last Monday including today
  })();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Weekly Contact Avg (This Week)
          <Badge variant="outline" className="ml-auto text-xs font-normal">Day {daysElapsed} of 5</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No shift recap data for this week yet.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map(r => {
              const avg = r.days > 0 ? (r.total / r.days).toFixed(1) : '—';
              const pct = Math.min(100, (r.total / (daysElapsed * 25)) * 100); // 25 = rough daily target
              return (
                <div key={r.staff_name} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 font-medium truncate">{r.staff_name}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-muted-foreground">{avg}/day</span>
                  <span className="w-10 text-right font-semibold">{r.total}</span>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-1">
              Avg = total contacts ÷ shifts worked this week · Bar = % toward 25/day target
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SyncLog {
  id: string;
  sync_type: string;
  records_synced: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function Admin() {
  const { user } = useAuth();
  const { introsBooked, introsRun, refreshData } = useData();
  const navigate = useNavigate();
  const [spreadsheetIdInput, setSpreadsheetIdInput] = useState(getSpreadsheetId() || '');
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Global date filter state for Overview tab
  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  
  // Computed date range based on preset/custom selection
  const dateRange = useMemo(() => {
    return getDateRangeForPreset(datePreset, customRange);
  }, [datePreset, customRange]);
  

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch sync logs
        const { data: logs } = await supabase
          .from('sheets_sync_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
        if (logs) setSyncLogs(logs as SyncLog[]);
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Only admin can access
  if (user?.role !== 'Admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSaveSpreadsheetId = () => {
    setSpreadsheetId(spreadsheetIdInput);
    toast.success('Spreadsheet ID saved!');
  };

  const handleRefresh = async () => {
    await refreshData();
    toast.success('Data refreshed!');
  };

  const handleSyncComplete = async () => {
    await refreshData();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage data sync, edit records, and view team stats
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview" className="gap-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
          <TabsTrigger value="coaching" className="gap-1">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Coaching</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1">
            <Megaphone className="w-4 h-4" />
            <span className="hidden sm:inline">Campaigns</span>
          </TabsTrigger>
          <TabsTrigger value="referrals" className="gap-1">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Referrals</span>
          </TabsTrigger>
          <TabsTrigger value="stories" className="gap-1">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Stories</span>
          </TabsTrigger>
          <TabsTrigger value="scripts" className="gap-1">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Scripts</span>
          </TabsTrigger>
        </TabsList>

        {/* Coaching Tab */}
        <TabsContent value="coaching" className="space-y-4">
          <CoachingView />
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <CampaignsPanel />
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals" className="space-y-4">
          <ReferralTracker />
          <ReferralTree />
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Team Meeting Card */}
          <Card className="cursor-pointer hover:bg-muted/50 transition" onClick={() => navigate('/meeting')}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold">Team Meeting</p>
                  <p className="text-sm text-muted-foreground">Next: {format(getCurrentMeetingMonday(), 'EEEE, MMM d')}</p>
                </div>
              </div>
              <Button size="sm" variant="outline">Open Meeting Prep</Button>
            </CardContent>
          </Card>

          {/* Global Date Filter */}
          <DateRangeFilter
            preset={datePreset}
            customRange={customRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomRange}
            dateRange={dateRange || { start: new Date(), end: new Date() }}
          />

          {/* Business Health Dashboard */}
          <AdminOverviewHealth dateRange={dateRange} />

          {/* AMC Log */}
          <AmcLogForm />

          {/* Pay Period Commission */}
          <PayPeriodCommission dateRange={dateRange} />
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-4">
          <WeeklyContactAvgCard />
          <DuplicateDetectionCard />
          <IntegrityDashboard />
          <VipBulkImport />
          <ShiftRecapsEditor />
          <PhoneBackfillCard />
          <QuestionnaireReconcileCard />
          <QuestionnaireSlugBackfillCard />
        </TabsContent>

        {/* Stories Tab */}
        <TabsContent value="stories" className="space-y-4">
          <SuccessStoriesPanel />
        </TabsContent>

        {/* Scripts Tab */}
        <TabsContent value="scripts" className="space-y-4">
          <ScriptsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
