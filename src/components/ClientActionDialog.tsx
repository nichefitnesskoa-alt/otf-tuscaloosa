import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarSync, UserPlus, FileText } from 'lucide-react';
import { PotentialMatch } from '@/hooks/useDuplicateDetection';

interface ClientActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: PotentialMatch;
  onReschedule: () => void;
  onSecondIntro: () => void;
  onResendQuestionnaire: () => void;
}

export default function ClientActionDialog({
  open,
  onOpenChange,
  client,
  onReschedule,
  onSecondIntro,
  onResendQuestionnaire,
}: ClientActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">What would you like to do?</DialogTitle>
          <DialogDescription className="text-sm">
            <span className="font-medium text-foreground">{client.member_name}</span>
            {' — '}
            <span>{client.class_date}</span>
            {client.booking_status && (
              <Badge variant="outline" className="ml-2 text-xs">{client.booking_status}</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3"
            onClick={onReschedule}
          >
            <CalendarSync className="w-5 h-5 text-primary shrink-0" />
            <div className="text-left">
              <div className="font-medium">Reschedule</div>
              <div className="text-xs text-muted-foreground">Update the existing booking's date/time</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3"
            onClick={onSecondIntro}
          >
            <UserPlus className="w-5 h-5 text-primary shrink-0" />
            <div className="text-left">
              <div className="font-medium">Book 2nd Intro</div>
              <div className="text-xs text-muted-foreground">Create a new booking linked to the original</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3"
            onClick={onResendQuestionnaire}
          >
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div className="text-left">
              <div className="font-medium">Resend Questionnaire</div>
              <div className="text-xs text-muted-foreground">Get the pre-intro questionnaire link for this client</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
