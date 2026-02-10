import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PotentialMatch } from '@/hooks/useDuplicateDetection';
import ClientNameAutocomplete from './ClientNameAutocomplete';
import RescheduleClientDialog from './RescheduleClientDialog';
import ClientActionDialog from './ClientActionDialog';
import QuestionnaireLink from './QuestionnaireLink';
import QuestionnaireResponseViewer from './QuestionnaireResponseViewer';
import { LEAD_SOURCES, COACHES } from '@/types';

export interface IntroBookingData {
  id: string;
  memberName: string;
  introDate: string;
  introTime: string;
  leadSource: string;
  coachName: string;
  notes: string;
  originatingBookingId?: string;
  questionnaireId?: string;
  questionnaireStatus?: 'not_sent' | 'sent' | 'completed';
}

interface IntroBookingEntryProps {
  booking: IntroBookingData;
  index: number;
  onUpdate: (index: number, updates: Partial<IntroBookingData>) => void;
  onRemove: (index: number) => void;
  currentUserName?: string;
}

export default function IntroBookingEntry({ 
  booking, 
  index, 
  onUpdate, 
  onRemove,
  currentUserName = 'Unknown',
}: IntroBookingEntryProps) {
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [selectedClient, setSelectedClient] = useState<PotentialMatch | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);

  const handleNameChange = useCallback((value: string) => {
    // Reset dismissed warning when name changes significantly
    if (dismissedWarning && value.length < 3) {
      setDismissedWarning(false);
    }
    onUpdate(index, { memberName: value });
  }, [index, onUpdate, dismissedWarning]);

  const handleSelectExisting = useCallback((client: PotentialMatch) => {
    setSelectedClient(client);
    setShowActionDialog(true);
  }, []);

  const handleChooseReschedule = useCallback(() => {
    setShowActionDialog(false);
    setShowRescheduleDialog(true);
  }, []);

  const handleChoose2ndIntro = useCallback(() => {
    if (!selectedClient) return;
    setShowActionDialog(false);
    setDismissedWarning(true);
    onUpdate(index, {
      memberName: selectedClient.member_name,
      leadSource: selectedClient.lead_source,
      notes: `2nd intro - Original booking: ${selectedClient.class_date}`,
      originatingBookingId: selectedClient.id,
    });
  }, [selectedClient, index, onUpdate]);

  const handleChooseResendQuestionnaire = useCallback(async () => {
    if (!selectedClient) return;
    setShowActionDialog(false);
    setDismissedWarning(true);
    // Populate form with existing client info
    onUpdate(index, {
      memberName: selectedClient.member_name,
      introDate: selectedClient.class_date,
      introTime: selectedClient.intro_time || '',
      leadSource: selectedClient.lead_source,
      notes: selectedClient.fitness_goal || '',
    });
    // Look up existing questionnaire for this booking
    const { data } = await supabase
      .from('intro_questionnaires')
      .select('id, status')
      .eq('booking_id', selectedClient.id)
      .maybeSingle();
    if (data) {
      onUpdate(index, {
        questionnaireId: data.id,
        questionnaireStatus: data.status as 'not_sent' | 'sent' | 'completed',
      });
    }
  }, [selectedClient, index, onUpdate]);

  const handleCreateNew = useCallback(() => {
    setDismissedWarning(true);
  }, []);

  const handleRescheduleSuccess = useCallback((updatedData: { date: string; time: string }) => {
    if (!selectedClient) return;
    setShowRescheduleDialog(false);
    // Populate form with updated info instead of clearing
    onUpdate(index, {
      memberName: selectedClient.member_name,
      introDate: updatedData.date,
      introTime: updatedData.time,
      leadSource: selectedClient.lead_source,
      notes: selectedClient.fitness_goal || '',
    });
    setDismissedWarning(true);
    setSelectedClient(null);
  }, [index, onUpdate, selectedClient]);

  return (
    <>
      <div className="p-3 bg-muted/50 rounded-lg space-y-3 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>

        <div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Member Name *</Label>
            {dismissedWarning && (
              <Badge variant="secondary" className="text-xs py-0 px-1.5">
                <AlertTriangle className="w-3 h-3 mr-1 text-destructive" />
                Similar name exists
              </Badge>
            )}
          </div>
          <div className="mt-1">
            <ClientNameAutocomplete
              value={booking.memberName}
              onChange={handleNameChange}
              onSelectExisting={handleSelectExisting}
              onCreateNew={handleCreateNew}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Intro Date *</Label>
            <Input
              type="date"
              value={booking.introDate}
              onChange={(e) => onUpdate(index, { introDate: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Intro Time</Label>
            <Input
              type="time"
              value={booking.introTime}
              onChange={(e) => onUpdate(index, { introTime: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Lead Source *</Label>
          <Select
            value={booking.leadSource}
            onValueChange={(v) => onUpdate(index, { leadSource: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select source..." />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Who's Coaching</Label>
          <Select
            value={booking.coachName}
            onValueChange={(v) => onUpdate(index, { coachName: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select coach..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TBD">TBD</SelectItem>
              {COACHES.map((coach) => (
                <SelectItem key={coach} value={coach}>{coach}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea
            value={booking.notes}
            onChange={(e) => onUpdate(index, { notes: e.target.value })}
            className="mt-1 min-h-[60px]"
            placeholder="Any notes..."
          />
        </div>

        {/* Questionnaire Link */}
        <QuestionnaireLink
          bookingId={booking.id}
          memberName={booking.memberName}
          introDate={booking.introDate}
          introTime={booking.introTime}
          questionnaireId={booking.questionnaireId}
          questionnaireStatus={booking.questionnaireStatus}
          onQuestionnaireCreated={(id) => onUpdate(index, { questionnaireId: id, questionnaireStatus: 'not_sent' })}
          onStatusChange={(status) => onUpdate(index, { questionnaireStatus: status })}
        />

        {/* Questionnaire Response Viewer */}
        {booking.questionnaireId && (
          <QuestionnaireResponseViewer
            questionnaireId={booking.questionnaireId}
            questionnaireStatus={booking.questionnaireStatus}
          />
        )}
      </div>

      {selectedClient && (
        <>
          <ClientActionDialog
            open={showActionDialog}
            onOpenChange={(open) => {
              setShowActionDialog(open);
              if (!open) setSelectedClient(null);
            }}
            client={selectedClient}
            onReschedule={handleChooseReschedule}
            onSecondIntro={handleChoose2ndIntro}
            onResendQuestionnaire={handleChooseResendQuestionnaire}
          />
          <RescheduleClientDialog
            open={showRescheduleDialog}
            onOpenChange={(open) => {
              setShowRescheduleDialog(open);
              if (!open) setSelectedClient(null);
            }}
            client={selectedClient}
            currentUserName={currentUserName}
            onSuccess={handleRescheduleSuccess}
          />
        </>
      )}
    </>
  );
}
