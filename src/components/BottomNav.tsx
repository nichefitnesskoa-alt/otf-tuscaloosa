import { useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, GitBranch, Home, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const visibleItems = [
  { path: '/my-day', label: 'My Day', icon: Home },
  { path: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { path: '/recaps', label: 'Studio', icon: TrendingUp },
  { path: '/admin', label: 'Admin', icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

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
