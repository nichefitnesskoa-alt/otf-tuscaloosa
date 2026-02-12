import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Settings, TrendingUp, ClipboardList, Users, GitBranch, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useFollowUpCount } from '@/components/leads/FollowUpQueue';

const navItems = [
  { path: '/shift-recap', label: 'Recap', icon: FileText },
  { path: '/leads', label: 'Leads', icon: Users },
  { path: '/scripts', label: 'Scripts', icon: MessageSquare },
  { path: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { path: '/my-shifts', label: 'My Shifts', icon: ClipboardList },
  { path: '/recaps', label: 'Studio', icon: TrendingUp },
];

const adminItem = { path: '/admin', label: 'Admin', icon: Settings };

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: overdueCount = 0 } = useFollowUpCount();

  const items = user?.role === 'Admin' ? [...navItems, adminItem] : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const showBadge = item.path === '/leads' && overdueCount > 0;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full px-2 transition-colors relative',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-5 h-5 mb-1', isActive && 'stroke-[2.5px]')} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {overdueCount > 9 ? '9+' : overdueCount}
                  </span>
                )}
              </div>
              <span className={cn(
                'text-xs font-medium',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 w-12 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
