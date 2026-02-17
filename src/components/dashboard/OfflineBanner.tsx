import { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNowStrict } from 'date-fns';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { usingCachedData, lastSyncAt, pendingQueueCount, runSyncNow } = useData();
  const [showReconnect, setShowReconnect] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnect(false);
    } else if (wasOffline) {
      setShowReconnect(true);
      setWasOffline(false);
      const timer = setTimeout(() => setShowReconnect(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const result = await runSyncNow();
      if (result.synced > 0) toast.success(`Synced ${result.synced} action${result.synced !== 1 ? 's' : ''}`);
      if (result.failed > 0) toast.error(`${result.failed} action${result.failed !== 1 ? 's' : ''} failed to sync`);
    } catch {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const showOffline = !isOnline;
  const showCached = isOnline && usingCachedData;
  const showPending = isOnline && pendingQueueCount > 0;

  if (!showOffline && !showReconnect && !showCached && !showPending) return null;

  const cacheAgo = lastSyncAt
    ? formatDistanceToNowStrict(new Date(lastSyncAt), { addSuffix: true })
    : 'unknown';

  return (
    <div className="space-y-1">
      {showOffline && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">
            Offline — using cached data{lastSyncAt ? ` from ${cacheAgo}` : ''}.
            {pendingQueueCount > 0 && ` ${pendingQueueCount} pending action${pendingQueueCount !== 1 ? 's' : ''}.`}
          </span>
        </div>
      )}

      {showReconnect && !showOffline && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Wifi className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">Back online!</span>
          {pendingQueueCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[11px] text-emerald-700 hover:bg-emerald-100 gap-1"
              onClick={handleSyncNow}
              disabled={isSyncing}
            >
              <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
              Sync Now
            </Button>
          )}
        </div>
      )}

      {showCached && !showOffline && !showReconnect && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-warning/10 text-warning border border-warning/20">
          <CloudOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">Showing cached data{lastSyncAt ? ` from ${cacheAgo}` : ''}.</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] gap-1"
            onClick={handleSyncNow}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
            Retry
          </Button>
        </div>
      )}

      {showPending && !showOffline && !showReconnect && !showCached && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">{pendingQueueCount} pending sync action{pendingQueueCount !== 1 ? 's' : ''}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] text-blue-700 hover:bg-blue-100 gap-1"
            onClick={handleSyncNow}
            disabled={isSyncing}
          >
            Sync Now
          </Button>
        </div>
      )}
    </div>
  );
}
