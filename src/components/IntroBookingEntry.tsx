import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, AlertTriangle, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PotentialMatch } from '@/hooks/useDuplicateDetection';
import ClientNameAutocomplete from './ClientNameAutocomplete';
import RescheduleClientDialog from './RescheduleClientDialog';
import ClientActionDialog from './ClientActionDialog';
import QuestionnaireLink from './QuestionnaireLink';
import QuestionnaireResponseViewer from './QuestionnaireResponseViewer';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';
import { useAuth } from '@/context/AuthContext';
import { LEAD_SOURCES, COACHES } from '@/types';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';

export interface IntroBookingData {
  id: string;
  memberName: string;
  phone: string;
  email: string;
  introDate: string;
  introTime: string;
  leadSource: string;
  coachName: string;
  notes: string;
  originatingBookingId?: string;
  questionnaireId?: string;
  questionnaireStatus?: 'not_sent' | 'sent' | 'completed';
  bringingFriend: boolean;
  friendFirstName: string;
  friendLastName: string;
  friendPhone: string;
  friendEmail: string;
  friendQuestionnaireId?: string;
  friendQuestionnaireStatus?: 'not_sent' | 'sent' | 'completed';
  referredByMemberName?: string;
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
  const { user } = useAuth();
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [selectedClient, setSelectedClient] = useState<PotentialMatch | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showScripts, setShowScripts] = useState(false);

  // Compute merge context for scripts
  const nameParts = booking.memberName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const computeTodayTomorrow = () => {
    if (!booking.introDate) return undefined;
    try {
      const d = parseISO(booking.introDate);
      if (isToday(d)) return 'today';
      if (isTomorrow(d)) return 'tomorrow';
      return format(d, 'EEEE');
    } catch { return undefined; }
  };

  const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';

  // Fetch slug for questionnaire link (fix: useEffect instead of useState)
  const [questionnaireSlug, setQuestionnaireSlug] = useState<string | null>(null);
  
  useEffect(() => {
    if (!booking.questionnaireId) {
      setQuestionnaireSlug(null);
      return;
    }
    supabase
      .from('intro_questionnaires')
      .select('slug' as any)
      .eq('id', booking.questionnaireId)
      .maybeSingle()
      .then(({ data }) => {
        if ((data as any)?.slug) setQuestionnaireSlug((data as any).slug);
      });
  }, [booking.questionnaireId]);

  // Fetch slug for friend's questionnaire
  const [friendQuestionnaireSlug, setFriendQuestionnaireSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!booking.friendQuestionnaireId) {
      setFriendQuestionnaireSlug(null);
      return;
    }
    supabase
      .from('intro_questionnaires')
      .select('slug' as any)
      .eq('id', booking.friendQuestionnaireId)
      .maybeSingle()
      .then(({ data }) => {
        if ((data as any)?.slug) setFriendQuestionnaireSlug((data as any).slug);
      });
  }, [booking.friendQuestionnaireId]);

  const questionnaireLink = questionnaireSlug
    ? `${PUBLISHED_URL}/q/${questionnaireSlug}`
    : booking.questionnaireId
      ? `${PUBLISHED_URL}/q/${booking.questionnaireId}`
      : undefined;

  const friendQuestionnaireLink = friendQuestionnaireSlug
    ? `${PUBLISHED_URL}/q/${friendQuestionnaireSlug}`
    : booking.friendQuestionnaireId
      ? `${PUBLISHED_URL}/q/${booking.friendQuestionnaireId}`
      : undefined;

  const scriptMergeContext = {
    'first-name': firstName,
    'last-name': lastName,
    'sa-name': user?.name || currentUserName,
    day: booking.introDate ? format(parseISO(booking.introDate), 'EEEE') : undefined,
    time: booking.introTime || undefined,
    'today/tomorrow': computeTodayTomorrow(),
    'questionnaire-link': questionnaireLink,
    'friend-questionnaire-link': friendQuestionnaireLink,
  };

  const handleNameChange = useCallback((value: string) => {
    if (dismissedWarning && value.length < 3) {
      setDismissedWarning(false);
    }
    onUpdate(index, { memberName: value });

    // Auto-populate phone/email from leads table when name matches
    if (value.trim().split(/\s+/).length >= 2) {
      const parts = value.trim().split(/\s+/);
      const fn = parts[0];
      const ln = parts.slice(1).join(' ');
      supabase
        .from('leads')
        .select('phone, email')
        .ilike('first_name', fn)
        .ilike('last_name', ln)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const updates: Partial<IntroBookingData> = {};
            if (data.phone && !booking.phone) updates.phone = data.phone;
            if (data.email && !booking.email) updates.email = data.email;
            if (Object.keys(updates).length > 0) onUpdate(index, updates);
          }
        });
    }
  }, [index, onUpdate, dismissedWarning, booking.phone, booking.email]);

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
    onUpdate(index, {
      memberName: selectedClient.member_name,
      introDate: selectedClient.class_date,
      introTime: selectedClient.intro_time || '',
      leadSource: selectedClient.lead_source,
      notes: selectedClient.fitness_goal || '',
    });
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

  // Friend name for questionnaire link
  const friendFullName = `${booking.friendFirstName} ${booking.friendLastName}`.trim();

  return (
    <>
      <div className="p-3 bg-muted/50 rounded-lg space-y-3 relative">
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onRemove(index)}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>

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

        {/* Phone & Email */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Phone *</Label>
            <Input
              type="tel"
              value={booking.phone}
              onChange={(e) => onUpdate(index, { phone: e.target.value })}
              placeholder="(555) 123-4567"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Email <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              type="email"
              value={booking.email}
              onChange={(e) => onUpdate(index, { email: e.target.value })}
              placeholder="email@example.com"
              className="mt-1"
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

        {/* Referred By - shown when lead source is Member Referral */}
        {booking.leadSource === 'Member Referral' && (
          <div>
            <Label className="text-xs">Referred By (Member Name)</Label>
            <Input
              value={booking.referredByMemberName || ''}
              onChange={(e) => onUpdate(index, { referredByMemberName: e.target.value })}
              placeholder="Who referred them?"
              className="mt-1"
            />
          </div>
        )}

        {/* Bringing a Friend Toggle - appears after lead source */}
        {booking.leadSource && (
          <div className="border border-dashed border-primary/30 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <Label className="text-xs font-medium">Bringing a friend?</Label>
              </div>
              <Switch
                checked={booking.bringingFriend}
                onCheckedChange={(checked) => onUpdate(index, { bringingFriend: checked })}
              />
            </div>

            {booking.bringingFriend && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Friend's First Name *</Label>
                    <Input
                      value={booking.friendFirstName}
                      onChange={(e) => onUpdate(index, { friendFirstName: e.target.value })}
                      placeholder="First name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Friend's Last Name</Label>
                    <Input
                      value={booking.friendLastName}
                      onChange={(e) => onUpdate(index, { friendLastName: e.target.value })}
                      placeholder="Last name"
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Phone *</Label>
                    <Input
                      type="tel"
                      value={booking.friendPhone}
                      onChange={(e) => onUpdate(index, { friendPhone: e.target.value })}
                      placeholder="Phone number"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      type="email"
                      value={booking.friendEmail}
                      onChange={(e) => onUpdate(index, { friendEmail: e.target.value })}
                      placeholder="Email"
                      className="mt-1"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Same date/time/coach as above • Lead source: {booking.leadSource} (Friend)
                </p>

                {/* Friend's Questionnaire Link */}
                {booking.friendFirstName.length >= 2 && (
                  <QuestionnaireLink
                    bookingId={`friend-${booking.id}`}
                    memberName={friendFullName}
                    introDate={booking.introDate}
                    introTime={booking.introTime}
                    questionnaireId={booking.friendQuestionnaireId}
                    questionnaireStatus={booking.friendQuestionnaireStatus}
                    onQuestionnaireCreated={(id) => onUpdate(index, { friendQuestionnaireId: id, friendQuestionnaireStatus: 'not_sent' })}
                    onStatusChange={(status) => onUpdate(index, { friendQuestionnaireStatus: status })}
                  />
                )}
              </div>
            )}
          </div>
        )}

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

        {/* Send Script Button - visible black button at bottom */}
        <Button
          onClick={() => setShowScripts(true)}
          className="w-full bg-black text-white hover:bg-black/90"
        >
          Send Script
        </Button>
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
      <ScriptPickerSheet
        open={showScripts}
        onOpenChange={setShowScripts}
        suggestedCategories={['booking_confirmation', 'pre_class_reminder']}
        mergeContext={scriptMergeContext}
        bookingId={undefined}
        questionnaireId={booking.questionnaireId}
        friendQuestionnaireId={booking.friendQuestionnaireId}
        onQuestionnaireSent={() => onUpdate(index, { questionnaireStatus: 'sent' })}
        onFriendQuestionnaireSent={() => onUpdate(index, { friendQuestionnaireStatus: 'sent' })}
      />
    </>
  );
}
