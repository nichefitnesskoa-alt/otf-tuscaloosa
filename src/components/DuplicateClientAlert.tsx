import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PotentialMatch } from '@/hooks/useDuplicateDetection';
import RescheduleClientDialog from './RescheduleClientDialog';
import { AlertTriangle, Calendar, MapPin, User, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface DuplicateClientAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputName: string;
  matches: PotentialMatch[];
  currentUserName: string;
  onCreateAnyway: () => void;
  onCancel: () => void;
  onRescheduleSuccess: () => void;
}

export default function DuplicateClientAlert({
  open,
  onOpenChange,
  inputName,
  matches,
  currentUserName,
  onCreateAnyway,
  onCancel,
  onRescheduleSuccess,
}: DuplicateClientAlertProps) {
  const [selectedClient, setSelectedClient] = useState<PotentialMatch | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);

  const handleUpdateClient = (client: PotentialMatch) => {
    setSelectedClient(client);
    setShowReschedule(true);
    onOpenChange(false);
  };

  const handleRescheduleSuccess = () => {
    setShowReschedule(false);
    setSelectedClient(null);
    onRescheduleSuccess();
  };

  const getMatchBadge = (matchType: 'exact' | 'fuzzy' | 'partial') => {
    switch (matchType) {
      case 'exact':
        return <Badge variant="destructive">Exact Match</Badge>;
      case 'fuzzy':
        return <Badge variant="secondary">Similar Name</Badge>;
      case 'partial':
        return <Badge variant="outline">Partial Match</Badge>;
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const upperStatus = status.toUpperCase();
    
    if (upperStatus.includes('ACTIVE')) {
      return <Badge variant="default">Active</Badge>;
    }
    if (upperStatus.includes('2ND INTRO')) {
      return <Badge variant="secondary">2nd Intro</Badge>;
    }
    if (upperStatus.includes('NOT INTERESTED')) {
      return <Badge variant="outline">Not Interested</Badge>;
    }
    if (upperStatus.includes('NO-SHOW') || upperStatus.includes('NO SHOW')) {
      return <Badge variant="destructive">No-show</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + 'T00:00:00'), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Potential Duplicate Found
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{inputName}" may already exist in the system. Please review the matches below:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 my-4">
            {matches.map((match) => (
              <div
                key={match.id}
                className="p-4 border rounded-lg bg-card space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">{match.member_name}</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {getMatchBadge(match.matchType)}
                      {getStatusBadge(match.booking_status)}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Booked: {formatDate(match.class_date)}</span>
                    {match.intro_time && <span>at {match.intro_time}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>Lead Source: {match.lead_source}</span>
                  </div>
                  {match.booked_by && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>Booked by: {match.booked_by}</span>
                    </div>
                  )}
                </div>

                {match.warningMessage && (
                  <div className="p-2 bg-muted rounded text-sm text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
                    {match.warningMessage}
                  </div>
                )}

                <Button
                  onClick={() => handleUpdateClient(match)}
                  className="w-full"
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Update This Client
                </Button>
              </div>
            ))}
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={onCancel} className="sm:mr-auto">
              Cancel
            </Button>
            <Button variant="secondary" onClick={onCreateAnyway}>
              Create New Booking Anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedClient && (
        <RescheduleClientDialog
          open={showReschedule}
          onOpenChange={setShowReschedule}
          client={selectedClient}
          currentUserName={currentUserName}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </>
  );
}
