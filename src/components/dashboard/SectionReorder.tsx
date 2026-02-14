import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { GripVertical, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_SECTION_ORDER = [
  'unresolved-intros',
  'todays-intros',
  'new-leads',
  'tomorrows-intros',
  'coming-up',
  'followups-due',
  'completed-today',
  'shift-handoff',
];

const SECTION_LABELS: Record<string, string> = {
  'unresolved-intros': 'Unresolved Intros',
  'todays-intros': "Today's Intros",
  'new-leads': 'New Leads',
  'tomorrows-intros': "Tomorrow's Intros",
  'coming-up': 'Coming Up',
  'followups-due': 'Follow-Ups Due',
  'completed-today': 'Completed Today',
  'shift-handoff': 'Shift Summary',
};

const STORAGE_KEY = 'myday_section_order';

export function getSectionOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure all sections are present
      const existing = new Set(parsed);
      const merged = [...parsed];
      for (const s of DEFAULT_SECTION_ORDER) {
        if (!existing.has(s)) merged.push(s);
      }
      return merged;
    }
  } catch {}
  return DEFAULT_SECTION_ORDER;
}

function saveSectionOrder(order: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

interface SectionReorderProps {
  onReorder: (order: string[]) => void;
}

export function SectionReorderButton({ onReorder }: SectionReorderProps) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(getSectionOrder());
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
  };

  const handleMoveDown = (idx: number) => {
    if (idx === order.length - 1) return;
    const next = [...order];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrder(next);
  };

  const handleSave = () => {
    saveSectionOrder(order);
    onReorder(order);
    setOpen(false);
    toast.success('Section order saved');
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => { setOrder(getSectionOrder()); setOpen(true); }}
      >
        <Settings2 className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Reorder Sections</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {order.map((id, idx) => (
              <div
                key={id}
                className="flex items-center gap-2 px-2 py-2 rounded border bg-card text-sm"
              >
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate">{SECTION_LABELS[id] || id}</span>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === order.length - 1}
                  >
                    ↓
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full">Save Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
