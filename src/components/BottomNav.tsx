import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, GitBranch, Home, Settings, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

const primaryItems = [
  { path: '/my-day', label: 'My Day', icon: Home },
  { path: '/pipeline', label: 'Pipeline', icon: GitBranch },
];

const adminItem = { path: '/admin', label: 'Admin', icon: Settings };

// Studio is accessible via the overflow "More" menu
const studioOverflowItem = { path: '/recaps', label: 'Studio', icon: TrendingUp };

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [moreOpen, setMoreOpen] = useState(false);
  const { canAccessAdmin } = useAuth();

  // Build visible primary items: My Day, Pipeline, Admin (if admin)
  const visibleItems = canAccessAdmin
    ? [...primaryItems, adminItem]
    : primaryItems;

  // Overflow always contains Studio
  const overflowItems = [studioOverflowItem];

  const isActiveOverflow = overflowItems.some(i => location.pathname === i.path);

  return (
    <>
      {/* More menu overlay */}
      {moreOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute bottom-16 right-2 bg-card border border-border rounded-lg shadow-lg p-1 min-w-[140px]" onClick={e => e.stopPropagation()}>
            {overflowItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setMoreOpen(false); }}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm min-h-[44px]',
                    isActive ? 'text-primary bg-primary/10 font-semibold' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full px-1 transition-colors relative min-w-[44px]',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="relative">
                  <Icon className={cn('w-5 h-5 mb-0.5', isActive && 'stroke-[2.5px]')} />
                </div>
                <span className={cn(
                  'text-[11px] font-medium',
                  isActive && 'font-semibold'
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 w-10 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}

          {/* More button — always shown */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full px-1 transition-colors relative min-w-[44px]',
              isActiveOverflow || moreOpen
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className={cn('w-5 h-5 mb-0.5', (isActiveOverflow || moreOpen) && 'stroke-[2.5px]')} />
            <span className={cn('text-[11px] font-medium', (isActiveOverflow || moreOpen) && 'font-semibold')}>
              More
            </span>
            {isActiveOverflow && (
              <div className="absolute bottom-0 w-10 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
