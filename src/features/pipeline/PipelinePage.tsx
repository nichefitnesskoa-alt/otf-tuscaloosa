/**
 * PipelinePage — assembled page for /pipeline route.
 *
 * ═══ Release Gate Checklist (single authoritative source) ═══
 *
 * Pre-release:
 * □ vitest run — all pipeline tests pass (corruption guards + behavioral + edge-case)
 * □ tsc --noEmit — no TypeScript errors
 *
 * Manual flows (test env):
 * □ Create booking → appears in Pipeline, correct canon fields
 * □ Create run with "No-show" → result_canon is NO_SHOW (not a booking status)
 * □ Edit run: change result from "Didn't Buy" to "Premier + OTBeat" → booking closes,
 *   buy_date set, AMC idempotent, follow-ups cleared, commission consistent
 * □ Edit run: change non-outcome fields only → buy_date/commission NOT overwritten by canonical fn
 * □ Purchase "Intro" → NO row in sales_outside_intro; booking closes via canonical fn
 * □ Purchase "Outside Intro" → row inserted in sales_outside_intro; booking closes via canonical fn
 * □ Auto-fix → syncs intro_owner, fixes corrupted timestamps, audit logged
 * □ Owner sync → audit entry in outcome_events with action_type "owner_sync"
 *
 * Performance & offline:
 * □ Virtual scroll: 300+ rows remain smooth
 * □ Offline toggle: outcome edits blocked with clear message
 * □ Refresh after reconnect: data refreshes
 *
 * VIP:
 * □ VIP bulk schedule: updates intros_booked and intro_questionnaires
 *
 * Guardrails:
 * □ assertNoOutcomeOwnedFields fires in dev if outcome fields leak into direct updates
 * □ normalizeIntroResultStrict throws in dev for unmapped outcomes
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitBranch, RefreshCw, Loader2, Wand2, Plus, WifiOff, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePipelineData } from './usePipelineData';
import { PipelineFiltersBar } from './components/PipelineFiltersBar';
import { PipelineSpreadsheet } from './components/PipelineSpreadsheet';
import { PipelineDialogs } from './components/PipelineDialogs';
import { PipelineNewLeadsTab } from './components/PipelineNewLeadsTab';
import { VipPipelineTable } from './components/VipPipelineTable';
import MembershipPurchasesPanel from '@/components/admin/MembershipPurchasesPanel';
import { PipelineScriptPicker } from '@/components/dashboard/PipelineScriptPicker';
import type { ClientJourney, PipelineBooking, PipelineRun } from './pipelineTypes';

export default function PipelinePage() {
  const { user } = useAuth();
  const { lastSyncAt, pendingQueueCount } = useData();
  const isOnline = useOnlineStatus();
  const pipeline = usePipelineData();

  // Dialog state
  const [dialogState, setDialogState] = useState<{
    type: string | null;
    booking?: PipelineBooking | null;
    run?: PipelineRun | null;
    journey?: ClientJourney | null;
  }>({ type: null });

  // Script picker state (lifted from PipelineSpreadsheet)
  const [scriptJourney, setScriptJourney] = useState<ClientJourney | null>(null);

  const openDialog = (type: string, data?: { booking?: PipelineBooking; run?: PipelineRun; journey?: ClientJourney }) => {
    if (type === 'refresh') { pipeline.refreshAll(); return; }
    setDialogState({ type, ...data });
  };

  const closeDialog = () => setDialogState({ type: null });

  const handleRefreshAfterAction = async () => {
    closeDialog();
    await pipeline.refreshAll();
  };

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Client Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Track clients from booking through purchase
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Data freshness */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatSyncTime(lastSyncAt)}
            {pendingQueueCount > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 ml-1">
                {pendingQueueCount} pending
              </Badge>
            )}
          </div>
          {!isOnline && (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <WifiOff className="w-3 h-3" /> Offline
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDialog('create_booking')}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Booking
          </Button>
          {pipeline.inconsistencyCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog('auto_fix')}
              className="text-warning"
            >
              <Wand2 className="w-4 h-4 mr-1" /> Fix {pipeline.inconsistencyCount}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => pipeline.fetchData()}
            disabled={pipeline.isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${pipeline.isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Pipeline Card */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <PipelineFiltersBar
            activeTab={pipeline.activeTab}
            setActiveTab={pipeline.setActiveTab}
            searchTerm={pipeline.searchTerm}
            setSearchTerm={pipeline.setSearchTerm}
            filterInconsistencies={pipeline.filterInconsistencies}
            setFilterInconsistencies={pipeline.setFilterInconsistencies}
            inconsistencyCount={pipeline.inconsistencyCount}
            tabCounts={pipeline.tabCounts}
            selectedLeadSource={pipeline.selectedLeadSource}
            setSelectedLeadSource={pipeline.setSelectedLeadSource}
            leadSourceOptions={pipeline.leadSourceOptions}
          />

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 bg-muted/50 rounded">
              <div className="font-bold">{pipeline.filteredJourneys.length}</div>
              <div className="text-muted-foreground">Showing</div>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="font-bold text-success">{pipeline.journeys.filter(j => j.hasSale).length}</div>
              <div className="text-muted-foreground">Purchased</div>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="font-bold text-primary">{pipeline.journeys.filter(j => j.status === 'active').length}</div>
              <div className="text-muted-foreground">Active</div>
            </div>
            <div className="p-2 bg-muted/50 rounded">
              <div className="font-bold text-warning">{pipeline.inconsistencyCount}</div>
              <div className="text-muted-foreground">Issues</div>
            </div>
          </div>

          {/* Tab content */}
          {pipeline.activeTab === 'leads' ? (
            <PipelineNewLeadsTab />
          ) : pipeline.activeTab === 'vip_class' ? (
            <VipPipelineTable />
          ) : (
            <PipelineSpreadsheet
              journeys={pipeline.filteredJourneys}
              vipGroups={pipeline.vipGroups}
              vipInfoMap={pipeline.vipInfoMap}
              isLoading={pipeline.isLoading}
              activeTab={pipeline.activeTab}
              isOnline={isOnline}
              onOpenDialog={openDialog}
              onRefresh={pipeline.refreshAll}
              onOpenScript={(j) => setScriptJourney(j)}
            />
          )}
        </CardContent>
      </Card>

      {/* Members Who Bought */}
      <MembershipPurchasesPanel />

      {/* All dialogs */}
      <PipelineDialogs
        dialogState={dialogState}
        onClose={closeDialog}
        onRefresh={handleRefreshAfterAction}
        journeys={pipeline.journeys}
        isOnline={isOnline}
        userName={user?.name || 'Admin'}
      />

      {/* Script Picker (rendered at page level for proper z-index) */}
      {scriptJourney && (
        <PipelineScriptPicker
          journey={scriptJourney as any}
          open={!!scriptJourney}
          onOpenChange={(open) => { if (!open) setScriptJourney(null); }}
        />
      )}
    </div>
  );
}
