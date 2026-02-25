import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MyDayShiftSummary } from '@/features/myDay/MyDayShiftSummary';

interface ActivityTrackerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivityTrackerSheet({ open, onOpenChange }: ActivityTrackerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto rounded-t-xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Log Shift Activity</SheetTitle>
        </SheetHeader>
        <MyDayShiftSummary />
      </SheetContent>
    </Sheet>
  );
}
