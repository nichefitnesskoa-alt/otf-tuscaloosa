/**
 * PipelinePage — assembled page for /pipeline route.
 *
 * ACCEPTANCE TESTS (manual):
 * - Edit outcome to Premier → booking closes, buy_date set, AMC idempotency, follow-ups cleared
 * - Edit outcome from Didn't Buy to No-show → follow-up regeneration rules correct
 * - Edit booking date/time/coach → views update, no duplicate records
 * - Record purchase → Pipeline row updates, metrics reflect sale
 * - Scrolling performance: 500+ rows remain smooth
 * - Offline: outcome edits blocked with clear message
 * - Data freshness indicator shows last sync + pending count
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
import { PipelineTable } from './components/PipelineTable';
import { PipelineDialogs } from './components/PipelineDialogs';
import MembershipPurchasesPanel from '@/components/admin/MembershipPurchasesPanel';
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

  const openDialog = (type: string, data?: { booking?: PipelineBooking; run?: PipelineRun; journey?: ClientJourney }) => {
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

          {/* Virtualized table */}
          <PipelineTable
            journeys={pipeline.filteredJourneys}
            vipGroups={pipeline.vipGroups}
            vipInfoMap={pipeline.vipInfoMap}
            isLoading={pipeline.isLoading}
            activeTab={pipeline.activeTab}
            isOnline={isOnline}
            onOpenDialog={openDialog}
            onRefresh={pipeline.refreshAll}
          />
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
    </div>
  );
}
