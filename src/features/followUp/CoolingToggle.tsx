/**
 * Toggle to show/hide recently contacted (cooling) items at bottom of follow-up tabs.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface CoolingToggleProps {
  coolingCount: number;
  children: React.ReactNode;
}

export function CoolingToggle({ coolingCount, children }: CoolingToggleProps) {
  const [show, setShow] = useState(false);

  if (coolingCount === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs text-muted-foreground gap-1.5 h-8"
        onClick={() => setShow(v => !v)}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {show ? 'Hide' : 'Show'} recently contacted ({coolingCount})
      </Button>
      {show && (
        <div className="opacity-50 space-y-6">
          {children}
        </div>
      )}
    </div>
  );
}
