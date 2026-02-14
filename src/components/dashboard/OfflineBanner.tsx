import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnect, setShowReconnect] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnect(false);
    };
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnect(true);
      // Hide reconnected message after 3s
      setTimeout(() => setShowReconnect(false), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !showReconnect) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
        isOffline
          ? 'bg-destructive/10 text-destructive border border-destructive/20'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Offline. Your actions will sync when connection returns.</span>
        </>
      ) : (
        <>
          <Wifi className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Back online!</span>
        </>
      )}
    </div>
  );
}
