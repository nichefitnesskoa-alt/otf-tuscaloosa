import { useLocation, useNavigate } from 'react-router-dom';
import { GitBranch, Home, Settings, Eye, Trophy, UserCheck, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useDataAudit } from '@/hooks/useDataAudit';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const isCoach = user?.role === 'Coach';
  const { failCount } = useDataAudit(isAdmin);
  const [coachFollowUpBadge, setCoachFollowUpBadge] = useState(0);

  // Coach badge count
  useEffect(() => {
    if (!isCoach || !user?.name) return;
    (async () => {
      const { count } = await (supabase
        .from('follow_up_queue')
        .select('id', { count: 'exact', head: true }) as any)
        .eq('owner_role', 'Coach')
        .eq('coach_owner', user.name)
        .is('not_interested_at', null)
        .is('transferred_to_sa_at', null);
      setCoachFollowUpBadge(count || 0);
    })();
  }, [isCoach, user?.name]);

  // Coach sees Coach View (single nav)
  if (isCoach) {
    const coachItems = [
      { path: '/coach-view', label: 'Coach View', icon: Eye },
      { path: '/wig', label: 'WIG', icon: Trophy },
      { path: '/my-intros', label: 'My Intros', icon: UserCheck },
      { path: '/scorecards/me', label: 'Scorecards', icon: ClipboardList },
    ];
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {coachItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full px-1 transition-colors relative min-w-[44px]',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="relative">
                  <Icon className={cn('w-5 h-5 mb-0.5', isActive && 'stroke-[2.5px]')} />
                  {item.path === '/my-intros' && coachFollowUpBadge > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-[#E8540A] text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                      {coachFollowUpBadge > 9 ? '9+' : coachFollowUpBadge}
                    </span>
                  )}
                </div>
                <span className={cn('text-[11px] font-medium', isActive && 'font-semibold')}>{item.label}</span>
                {isActive && <div className="absolute bottom-0 w-10 h-0.5 bg-primary rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  const visibleItems = isAdmin ? [
    { path: '/my-day', label: 'My Day', icon: Home },
    { path: '/wig', label: 'WIG', icon: Trophy },
    { path: '/pipeline', label: 'Pipeline', icon: GitBranch },
    { path: '/coach-view', label: 'Coach View', icon: Eye },
    { path: '/my-intros', label: 'My Intros', icon: UserCheck },
    { path: '/admin', label: 'Admin', icon: Settings },
  ] : [
    { path: '/my-day', label: 'My Day', icon: Home },
    { path: '/wig', label: 'WIG', icon: Trophy },
    { path: '/pipeline', label: 'Pipeline', icon: GitBranch },
  ];

  return (
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
                {item.path === '/admin' && failCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-0.5">
                    {failCount > 9 ? '9+' : failCount}
                  </span>
                )}
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
      </div>
    </nav>
  );
}
