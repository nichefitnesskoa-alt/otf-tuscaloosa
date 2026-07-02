/**
 * SelfSourcedLeadDialog — dialog wrapper around SelfSourcedLeadForm used
 * by the WIG SA Leaderboard's "+ Add Lead" button so it writes the same
 * self-sourced row (with `sourced_by_sa`) as MyDay's SelfSourcedLeadEntry.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SelfSourcedLeadForm } from '@/components/leads/SelfSourcedLeadForm';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadAdded?: () => void;
}

export function SelfSourcedLeadDialog({ open, onOpenChange, onLeadAdded }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a lead you sourced</DialogTitle>
        </DialogHeader>
        <SelfSourcedLeadForm
          onSaved={() => {
            onLeadAdded?.();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
