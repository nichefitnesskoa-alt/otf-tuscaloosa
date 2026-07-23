import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Settings as SettingsIcon, Database, BarChart3, Wrench, Phone, SearchCheck,
} from 'lucide-react';
import GiveawaysAdminTab from '@/components/admin/GiveawaysAdminTab';
import { MindbodyImportsPanel } from '@/components/admin/MindbodyImportsPanel';
import { Navigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import ReferralTracker from '@/components/admin/ReferralTracker';
import ReferralTree from '@/components/admin/ReferralTree';
import AdminOverviewHealth from '@/components/admin/AdminOverviewHealth';
import { IntegrityDashboard } from '@/components/admin/IntegrityDashboard';
import SuccessStoriesPanel from '@/components/admin/SuccessStoriesPanel';
import DataAuditDashboard from '@/components/admin/DataAuditDashboard';
import ArchiveOldDmLeads from '@/components/admin/ArchiveOldDmLeads';
import { LeadSheetImport } from '@/components/admin/LeadSheetImport';
import ScriptsPage from '@/pages/Scripts';
import HiringPipeline from '@/components/admin/HiringPipeline';
import ObjectionReport from '@/components/admin/ObjectionReport';
import ShiftTasksAdmin from '@/components/admin/ShiftTasksAdmin';
import StaffManagement from '@/components/admin/StaffManagement';
import { EventsAdminPanel } from '@/components/admin/EventsAdminPanel';
import { EventCohortPanel } from '@/components/admin/EventCohortPanel';
import { EventsIndexPanel } from '@/components/admin/EventsIndexPanel';
import { BingoAdminTab } from '@/components/admin/BingoAdminTab';
import { IntroSchedulerLinkCard } from '@/components/admin/IntroSchedulerLinkCard';
import { BookableScheduleAdmin } from '@/components/admin/BookableScheduleAdmin';
import { RingCentralHealthCard } from '@/components/admin/RingCentralHealthCard';
import { RingCentralUriTemplateCard } from '@/components/admin/RingCentralUriTemplateCard';

import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { getDateRangeForPreset, DatePreset, DateRange } from '@/lib/pay-period';

// ─────────────────────────────────────────────────────────────
// Ongoing utility cards. FixVipBookingTypesCard, QuestionnaireReconcileCard,
// and QuestionnaireSlugBackfillCard were retired Phase Three — DB queries
// confirmed zero pending rows and DB triggers keep those invariants going
// forward. See .agents/skills/system-change-audit/references/consumer-map.md.
// ─────────────────────────────────────────────────────────────

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

function DuplicateDetectionCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ flagged: number; moved: number } | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
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

// WeeklyContactAvgCard removed with the close-out ritual (Phase Four). Its
// data source (shift_recaps.calls_made/texts_sent/dms_sent) has no live
// writer anymore; the metric moved to ShiftScoreboard on MyDay.



function EventsSection() {
  const [eventId, setEventId] = useState<string | null>(null);
  return (
    <>
      <EventsAdminPanel />
      <EventsIndexPanel selectedEventId={eventId} onSelectEvent={setEventId} />
      <EventCohortPanel eventId={eventId} onEventIdChange={setEventId} />
    </>
  );
}

function Section({ value, title, subtitle, children }: { value: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="border rounded-md px-3 bg-card">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="text-left">
          <div className="text-base font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5 font-normal">{subtitle}</div>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-2 pb-4 space-y-4">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

// ─────────────────────────────────────────────────────────────
// Admin — four canonical buckets: Operations, Reporting, Data, Settings.
// Sub-sections within each bucket stack vertically; each section has its
// own header for orientation.
// ─────────────────────────────────────────────────────────────
export default function Admin() {
  const { user } = useAuth();
  const { refreshData } = useData();
  const [activeTab, setActiveTab] = useState('operations');

  const [datePreset, setDatePreset] = useState<DatePreset>('pay_period');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const dateRange = useMemo(
    () => getDateRangeForPreset(datePreset, customRange),
    [datePreset, customRange],
  );

  if (user?.role !== 'Admin') {
    return <Navigate to="/my-day" replace />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" />
          Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Operations, reporting, data health, and settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="operations" className="gap-1.5">
            <Wrench className="w-4 h-4" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="reporting" className="gap-1.5">
            <BarChart3 className="w-4 h-4" />
            Reporting
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-1.5">
            <Database className="w-4 h-4" />
            Data
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <SettingsIcon className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Operations */}
        <TabsContent value="operations" className="space-y-6 mt-4">
          <SectionHeader title="Success Stories" />
          <SuccessStoriesPanel />

          <SectionHeader title="Scripts" />
          <ScriptsPage />

          <SectionHeader title="Giveaways" />
          <GiveawaysAdminTab />

          <SectionHeader title="Events" />
          <EventsSection />

          <SectionHeader title="Summer Bingo" />
          <BingoAdminTab />

          <SectionHeader title="Hiring" />
          <HiringPipeline />
        </TabsContent>

        {/* Reporting */}
        <TabsContent value="reporting" className="space-y-6 mt-4">
          <SectionHeader title="Overview" subtitle="Business health for the selected date range" />
          <DateRangeFilter
            preset={datePreset}
            customRange={customRange}
            onPresetChange={setDatePreset}
            onCustomRangeChange={setCustomRange}
            dateRange={dateRange || { start: new Date(), end: new Date() }}
          />
          <AdminOverviewHealth dateRange={dateRange} />

          <SectionHeader title="Objections" />
          <ObjectionReport />

          <SectionHeader title="Referrals" />
          <ReferralTracker />
          <ReferralTree />

          <SectionHeader title="Unified Portal Imports" subtitle="Who marked leads and VIP registrants imported into Mindbody" />
          <MindbodyImportsPanel />

        </TabsContent>

        {/* Data */}
        <TabsContent value="data" className="space-y-6 mt-4">
          <SectionHeader title="Lead Sheet Import" />
          <LeadSheetImport />

          <SectionHeader title="Data Audit" />
          <DataAuditDashboard />

          <SectionHeader title="Duplicate Detection" />
          <DuplicateDetectionCard />

          <SectionHeader title="Integrity Dashboard" />
          <IntegrityDashboard />

          <SectionHeader title="RingCentral Webhook" subtitle="Auto-logs outbound texts as lead contacts. Subscription renews daily." />
          <RingCentralHealthCard />

          <SectionHeader title="Phone Backfill" subtitle="Ongoing — parses missing phones from email intake" />
          <PhoneBackfillCard />

          <SectionHeader title="Archive Old DM Leads" subtitle="Ongoing — rolling 30-day archive" />
          <ArchiveOldDmLeads />
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="space-y-6 mt-4">
          <SectionHeader title="Staff Management" />
          <StaffManagement />

          <SectionHeader title="Shift Tasks" />
          <ShiftTasksAdmin />

          <SectionHeader title="Intro Scheduler" />
          <IntroSchedulerLinkCard />
          <BookableScheduleAdmin />

          <SectionHeader title="RingCentral" subtitle="Deep-link template for the desktop app's SMS composer" />
          <RingCentralUriTemplateCard />

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await refreshData();
                toast.success('Data refreshed');
              }}
            >
              Refresh cached data
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
