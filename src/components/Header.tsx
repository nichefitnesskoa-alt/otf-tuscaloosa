import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LeadAlertBell } from '@/components/LeadAlertBell';

export function Header() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const roleColors = {
    Admin: 'bg-primary text-primary-foreground',
    SA: 'bg-info text-info-foreground',
    Coach: 'bg-success text-success-foreground',
  };

  return (
    <header className="sticky top-0 z-40 bg-foreground text-background overflow-hidden">
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-primary-foreground font-bold text-sm">OTF</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight">OrangeTheory</h1>
            <p className="text-xs opacity-70">Shift Recap</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
          <LeadAlertBell />
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <User className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium hidden sm:inline truncate">{user.name}</span>
            <Badge className={roleColors[user.role]} variant="secondary">
              {user.role}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="text-background hover:bg-background/10 flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
