import { useState, useEffect, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon: ReactNode;
  count?: number;
  countLabel?: string;
  defaultOpen?: boolean;
  /** Force open when items need action */
  forceOpen?: boolean;
  /** Extra class on card */
  className?: string;
  /** Right side of header */
  headerRight?: ReactNode;
  /** Emphasis ring */
  emphasis?: string;
  /** Sub-label under title */
  subLabel?: string;
  children: ReactNode;
  /** Action buttons on the collapsed header */
  headerActions?: ReactNode;
}

const STORAGE_KEY = 'myday_section_state';

function getSavedStates(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSectionState(id: string, open: boolean) {
  try {
    const states = getSavedStates();
    states[id] = open;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {}
}

export function CollapsibleSection({
  id,
  title,
  icon,
  count,
  countLabel,
  defaultOpen = true,
  forceOpen,
  className,
  headerRight,
  emphasis,
  subLabel,
  children,
  headerActions,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = getSavedStates();
    if (id in saved) return saved[id];
    return defaultOpen;
  });

  // If forceOpen changes to true, expand
  useEffect(() => {
    if (forceOpen && !isOpen) {
      setIsOpen(true);
      saveSectionState(id, true);
    }
  }, [forceOpen]);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    saveSectionState(id, next);
  };

  return (
    <Card id={`section-${id}`} className={cn(emphasis, className)}>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={toggle}
      >
        <CardTitle className="text-base flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
          {icon}
          <span className="truncate">{title}</span>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1 flex-shrink-0">
              {count}{countLabel ? ` ${countLabel}` : ''}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            {headerActions}
            {headerRight}
          </div>
        </CardTitle>
        {subLabel && (
          <p className="text-[10px] text-primary font-medium">{subLabel}</p>
        )}
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-2 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
