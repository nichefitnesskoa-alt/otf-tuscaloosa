import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export interface DrillPerson {
  name: string;
  date: string;
  detail?: string;
}

interface FunnelDrillSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  people: DrillPerson[];
  /** When provided, each person row becomes a tap target opening the
   *  journey card via the caller (PersonJourneyCard / useJourneyCard). */
  onPersonClick?: (p: DrillPerson) => void;
}

export function FunnelDrillSheet({ open, onOpenChange, title, people, onPersonClick }: FunnelDrillSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] px-4 pb-6">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">{title}</SheetTitle>
          <SheetDescription className="text-xs">
            {people.length} {people.length === 1 ? 'person' : 'people'}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(70vh-6rem)]">
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No records</p>
          ) : (
            <div className="space-y-1.5">
              {people.map((p, i) => {
                const inner = (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 hover:border-primary/60 transition-colors">
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.date}</p>
                    </div>
                    {p.detail && (
                      <Badge variant="secondary" className="ml-2 text-[10px] shrink-0">
                        {p.detail}
                      </Badge>
                    )}
                  </div>
                );
                if (onPersonClick) {
                  return (
                    <button
                      key={`${p.name}-${p.date}-${i}`}
                      type="button"
                      className="block w-full text-left cursor-pointer"
                      onClick={() => onPersonClick(p)}
                    >
                      {inner}
                    </button>
                  );
                }
                return <div key={`${p.name}-${p.date}-${i}`}>{inner}</div>;
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
