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
}

export function FunnelDrillSheet({ open, onOpenChange, title, people }: FunnelDrillSheetProps) {
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
              {people.map((p, i) => (
                <div key={`${p.name}-${p.date}-${i}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">{p.date}</p>
                  </div>
                  {p.detail && (
                    <Badge variant="secondary" className="ml-2 text-[10px] shrink-0">
                      {p.detail}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
