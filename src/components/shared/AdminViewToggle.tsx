/**
 * Admin View Toggle — visible only when the logged-in user is really Koa.
 * Lets Koa preview what SAs/coaches see on a given page.
 */
import { Eye, EyeOff, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsRealAdmin, useViewAsNonAdmin } from '@/hooks/useViewAsAdmin';

interface Props {
  className?: string;
}

export function AdminViewToggle({ className }: Props) {
  const isReallyAdmin = useIsRealAdmin();
  const [viewAsNonAdmin, setViewAsNonAdmin] = useViewAsNonAdmin();

  if (!isReallyAdmin) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border border-border bg-card p-1',
        className,
      )}
      role="tablist"
      aria-label="View mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={!viewAsNonAdmin}
        onClick={() => setViewAsNonAdmin(false)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer',
          !viewAsNonAdmin
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Shield className="w-3.5 h-3.5" />
        Admin view
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewAsNonAdmin}
        onClick={() => setViewAsNonAdmin(true)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer',
          viewAsNonAdmin
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {viewAsNonAdmin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        Staff view
      </button>
    </div>
  );
}
