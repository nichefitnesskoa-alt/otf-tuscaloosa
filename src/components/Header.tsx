import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { LogOut, User, CloudOff, Sun, Moon } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { GlobalSearch, GlobalSearchTrigger } from '@/components/GlobalSearch';
import { NotificationsBell } from '@/components/NotificationsBell';
import { useDarkMode } from '@/hooks/useDarkMode';
import { OTF, Theme, brandFont } from '@/lib/otfBrand';
import otfLogo from '@/assets/otf-logo-orange.png.asset.json';

export function Header() {
  const { user, logout } = useAuth();
  const { pendingQueueCount, lastSyncAt } = useData();
  const [searchOpen, setSearchOpen] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();

  if (!user) return null;

  const syncLabel = lastSyncAt
    ? formatDistanceToNowStrict(new Date(lastSyncAt), { addSuffix: true })
    : null;

  const iconBtn = 'flex-shrink-0 transition-opacity hover:opacity-70';

  return (
    <>
      <header
        className="sticky top-0 z-40 overflow-hidden"
        style={{
          backgroundColor: OTF.dark,
          color: OTF.bone,
          borderBottom: `1px solid ${Theme.border}`,
          ...brandFont,
        }}
      >
        <div className="flex items-center justify-between h-14 px-3 sm:px-4 min-w-0">
          {/* Left: logo lockup */}
          <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
            <img src={otfLogo.url} alt="OTF" className="h-7 w-auto" />
            <div className="min-w-0 leading-none">
              <p
                className="text-[11px] uppercase"
                style={{ color: OTF.bone, opacity: 0.55, letterSpacing: '0.18em' }}
              >
                Shift Recap
              </p>
              {syncLabel ? (
                <p className="text-[9px] mt-0.5" style={{ color: OTF.bone, opacity: 0.4 }}>
                  Synced {syncLabel}
                </p>
              ) : (
                <p className="text-[9px] mt-0.5" style={{ color: OTF.bone, opacity: 0.4 }}>
                  Tuscaloosa
                </p>
              )}
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2 flex-shrink-0" style={{ color: OTF.bone }}>
            {pendingQueueCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5"
                style={{
                  color: OTF.orange,
                  border: `1px solid ${OTF.orange}`,
                }}
              >
                <CloudOff className="w-2.5 h-2.5" />
                {pendingQueueCount}
              </span>
            )}
            <GlobalSearchTrigger onOpen={() => setSearchOpen(true)} />
            <NotificationsBell />
            <button
              onClick={toggleDark}
              className={iconBtn}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ color: OTF.bone }}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1.5 min-w-0 pl-1" style={{ borderLeft: `1px solid ${Theme.border}` }}>
              <User className="w-4 h-4 flex-shrink-0" style={{ color: OTF.bone, opacity: 0.7 }} />
              <span className="text-sm font-semibold hidden sm:inline truncate" style={{ color: OTF.bone }}>
                {user.name}
              </span>
              <span
                className="text-[9px] uppercase px-1.5 py-0.5"
                style={{
                  backgroundColor: OTF.orange,
                  color: OTF.dark,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                }}
              >
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              className={iconBtn}
              style={{ color: OTF.bone }}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
