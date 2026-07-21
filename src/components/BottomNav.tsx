import { useLocation, useNavigate } from 'react-router-dom';
import { GitBranch, Home, Settings, Eye, Trophy, Star, Flag, ListChecks, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useDataAudit } from '@/hooks/useDataAudit';
import { useMyOpenStickyCount } from '@/hooks/useStickyNotes';
import { canSee, isAdmin as isAdminCheck, type PermissionKey } from '@/lib/auth/roles';
import { OTF, Theme, brandFont } from '@/lib/otfBrand';

type NavItem = { path: string; label: string; icon: any; permKey: PermissionKey };

const ALL_NAV: NavItem[] = [
  { path: '/my-day',       label: 'My Day',       icon: Home,       permKey: 'nav.my_day' },
  { path: '/outreach-lists', label: 'Outreach', icon: ListChecks, permKey: 'nav.outreach_lists' },
  { path: '/sticky-notes', label: 'Sticky Notes', icon: StickyNote, permKey: 'nav.sticky_notes' },
  { path: '/coach-view',   label: 'Coach View',   icon: Eye,        permKey: 'nav.coach_view' },
  // Studio tile (/recaps) archived Phase Zero — folded into WIG + My Day.
  { path: '/wig',          label: 'WIG',          icon: Trophy,     permKey: 'nav.wig' },
  { path: '/the-table',    label: 'Own It',       icon: Flag,       permKey: 'nav.own_it' },
  { path: '/vips',         label: 'VIPs',         icon: Star,       permKey: 'nav.vips' },
  { path: '/pipeline',     label: 'Pipeline',     icon: GitBranch,  permKey: 'nav.pipeline' },
  { path: '/admin',        label: 'Admin',        icon: Settings,   permKey: 'nav.admin' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const { failCount } = useDataAudit(isAdmin);
  const stickyOpenCount = useMyOpenStickyCount(user?.name);

  const visibleItems = ALL_NAV.filter(item => {
    if (item.path === '/admin') return isAdmin;
    return canSee(user, item.permKey);
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-area-pb overflow-x-auto md:overflow-visible"
      style={{
        backgroundColor: OTF.dark,
        color: OTF.bone,
        borderTop: `1px solid ${Theme.border}`,
        ...brandFont,
      }}
    >
      <div className="flex items-center h-16 min-w-max md:min-w-0 md:w-full">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center px-3 h-full transition-colors relative min-w-[72px] md:min-w-0 md:flex-1"
              style={{
                color: isActive ? OTF.orange : OTF.bone,
                opacity: isActive ? 1 : 0.6,
              }}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5 mb-0.5', isActive && 'stroke-[2.5px]')} />
                {item.path === '/admin' && failCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] text-[9px] font-bold flex items-center justify-center px-0.5"
                    style={{ backgroundColor: OTF.orange, color: OTF.dark }}
                  >
                    {failCount > 9 ? '9+' : failCount}
                  </span>
                )}
                {item.path === '/sticky-notes' && stickyOpenCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] text-[9px] font-bold flex items-center justify-center px-0.5"
                    style={{ backgroundColor: OTF.orange, color: OTF.dark }}
                  >
                    {stickyOpenCount > 9 ? '9+' : stickyOpenCount}
                  </span>
                )}
              </div>
              <span
                className="text-[11px]"
                style={{ fontWeight: isActive ? 700 : 500 }}
              >
                {item.label}
              </span>
              {isActive && (
                <div
                  className="absolute bottom-0 w-10 h-[2px]"
                  style={{ backgroundColor: OTF.orange }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
