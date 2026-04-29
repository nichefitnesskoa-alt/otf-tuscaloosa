import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cleanCoachFallbackPhrasing, resolveFirstIntroCoachName } from '@/lib/script-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Copy, ClipboardCheck, Phone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ScriptTemplate } from '@/hooks/useScriptTemplates';
import { useLogScriptSent } from '@/hooks/useScriptSendLog';
import { useAuth } from '@/context/AuthContext';

/** Copy Phone button for Script tab — pulls phone from booking */
function CopyPhoneButton({ bookingId }: { bookingId?: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!bookingId) { setLoaded(true); return; }
    supabase.from('intros_booked')
      .select('phone, phone_e164')
      .eq('id', bookingId)
      .maybeSingle()
      .then(({ data }) => {
        const p = (data as any)?.phone_e164 || (data as any)?.phone || null;
        setPhone(p);
        setLoaded(true);
      });
  }, [bookingId]);

  if (!loaded || !bookingId) return null;

  const handleCopy = async () => {
    if (!phone) return;
    const clean = phone.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1');
    await navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="outline"
      className="min-h-[44px]"
      onClick={handleCopy}
      disabled={!phone}
    >
      <Phone className="w-4 h-4 mr-1" />
      {copied ? 'Copied!' : phone ? 'Copy Phone' : 'No Phone'}
    </Button>
  );
}

interface MergeContext {
  'first-name'?: string;
  'last-name'?: string;
  'sa-name'?: string;
  'coach-name'?: string;
  'coach-first-name'?: string;
  'first-intro-coach-name'?: string;
  'first-intro-coach-full-name'?: string;
  day?: string;
  time?: string;
  'today/tomorrow'?: string;
  'questionnaire-link'?: string;
  'friend-questionnaire-link'?: string;
  'location-name'?: string;
  'specific-thing'?: string;
  x?: string;
}

interface MessageGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ScriptTemplate;
  mergeContext?: MergeContext;
  leadId?: string;
  bookingId?: string;
  onLogged?: () => void;
  questionnaireId?: string;
  friendQuestionnaireId?: string;
  onQuestionnaireSent?: () => void;
  onFriendQuestionnaireSent?: () => void;
  contextNote?: string;
  bodyOverride?: string;
  onChangeScript?: () => void;
}

const MERGE_FIELD_REGEX = /\{([a-z\-\/]+)\}/g;

function extractUnfilledFields(body: string, context: MergeContext): string[] {
  const fields: string[] = [];
  let match;
  while ((match = MERGE_FIELD_REGEX.exec(body)) !== null) {
    const key = match[1] as keyof MergeContext;
    if (!context[key] && !fields.includes(key)) {
      fields.push(key);
    }
  }
  return fields;
}

function applyMergeFields(body: string, context: MergeContext, manual: Record<string, string>): string {
  return body.replace(MERGE_FIELD_REGEX, (full, key: string) => {
    const ctxVal = context[key as keyof MergeContext];
    if (ctxVal) return ctxVal;
    const manVal = manual[key];
    if (manVal) return manVal;
    return full;
  });
}

export function MessageGenerator({ open, onOpenChange, template, mergeContext = {}, leadId, bookingId, onLogged, questionnaireId, friendQuestionnaireId, onQuestionnaireSent, onFriendQuestionnaireSent, contextNote, bodyOverride, onChangeScript }: MessageGeneratorProps) {
  const { user } = useAuth();
  const logSent = useLogScriptSent();

  // Resolve {first-intro-coach-name} and {first-intro-coach-full-name} from the booking chain
  // when not pre-supplied. Falls back to the booking's own coach_name so the field auto-fills
  // in the vast majority of cases — SAs only see "Fill in missing fields" when no coach is
  // assigned anywhere in the chain.
  const [resolvedFirstIntroCoachFull, setResolvedFirstIntroCoachFull] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!open || !bookingId) {
      setResolvedFirstIntroCoachFull(null);
      return;
    }
    if (mergeContext['first-intro-coach-name'] && mergeContext['first-intro-coach-full-name']) {
      setResolvedFirstIntroCoachFull(null);
      return;
    }
    (async () => {
      let full = await resolveFirstIntroCoachName(bookingId);
      // Fallback: this booking's own coach_name (covers cases where chain lookup returns null)
      if (!full) {
        const { data } = await supabase
          .from('intros_booked')
          .select('coach_name')
          .eq('id', bookingId)
          .maybeSingle();
        const own = (data as any)?.coach_name as string | null | undefined;
        if (own && own.trim() && !/^tbd$/i.test(own.trim())) {
          full = own.trim();
        }
      }
      if (!cancelled) setResolvedFirstIntroCoachFull(full ?? null);
    })();
    return () => { cancelled = true; };
  }, [open, bookingId, mergeContext]);

  const resolvedFirstIntroCoachFirst = resolvedFirstIntroCoachFull
    ? resolvedFirstIntroCoachFull.split(/\s+/)[0]
    : null;

  const fullContext: MergeContext = useMemo(() => ({
    'location-name': 'Tuscaloosa',
    'sa-name': user?.name,
    ...(resolvedFirstIntroCoachFirst ? { 'first-intro-coach-name': resolvedFirstIntroCoachFirst } : {}),
    ...(resolvedFirstIntroCoachFull ? { 'first-intro-coach-full-name': resolvedFirstIntroCoachFull } : {}),
    ...mergeContext,
  }), [mergeContext, user, resolvedFirstIntroCoachFirst, resolvedFirstIntroCoachFull]);

  const templateBody = bodyOverride || template.body;
  const unfilledFields = useMemo(() => extractUnfilledFields(templateBody, fullContext), [templateBody, fullContext]);
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [editedMessage, setEditedMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const prevOpenRef = useRef(false);
  const userEditedRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      userEditedRef.current = false;
      setManualFields({});
      setCopied(false);
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || userEditedRef.current) return;
    const applied = cleanCoachFallbackPhrasing(applyMergeFields(templateBody, fullContext, manualFields));
    setEditedMessage(applied);
  }, [open, templateBody, fullContext, manualFields]);

  const handleManualChange = (field: string, value: string) => {
    userEditedRef.current = true;
    const newManual = { ...manualFields, [field]: value };
    setManualFields(newManual);
    setEditedMessage(cleanCoachFallbackPhrasing(applyMergeFields(templateBody, fullContext, newManual)));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedMessage);
    setCopied(true);
    toast({ title: 'Copied + Logged', description: 'Message copied and logged automatically' });
    setTimeout(() => setCopied(false), 2000);
    // Dispatch refresh so follow-up tabs update immediately
    window.dispatchEvent(new CustomEvent('myday:refresh'));

    // Auto-log script_send_log on copy (replaces manual "Log as Sent")
    try {
      await logSent.mutateAsync({
        template_id: template.id,
        lead_id: leadId || null,
        booking_id: bookingId || null,
        sent_by: user?.name || 'Unknown',
        message_body_sent: editedMessage,
        sequence_step_number: template.sequence_order || null,
      });
    } catch (e) {
      console.error('Failed to auto-log script send:', e);
    }

    // Also log script_actions for completion tracking
    try {
      await supabase.from('script_actions').insert({
        booking_id: bookingId || null,
        lead_id: leadId || null,
        action_type: 'script_sent',
        script_category: template.category,
        completed_by: user?.name || 'Unknown',
      });
    } catch (e) {
      console.error('Failed to log script action:', e);
    }

    // Auto-mark questionnaires as "sent" if IDs are provided
    if (questionnaireId) {
      await supabase
        .from('intro_questionnaires')
        .update({ status: 'sent' })
        .eq('id', questionnaireId)
        .eq('status', 'not_sent');
      onQuestionnaireSent?.();
    }
    if (friendQuestionnaireId) {
      await supabase
        .from('intro_questionnaires')
        .update({ status: 'sent' })
        .eq('id', friendQuestionnaireId)
        .eq('status', 'not_sent');
      onFriendQuestionnaireSent?.();
    }

    onLogged?.();
  };

  // handleLog removed — auto-log on copy replaces it

  // Render body with orange highlights for unfilled fields
  const renderHighlightedPreview = () => {
    const parts = editedMessage.split(MERGE_FIELD_REGEX);
    return parts.map((part, i) => {
      // Odd indexes are the captured group names
      if (i % 2 === 1) {
        // Check if this field is still unfilled
        const isFilled = fullContext[part as keyof MergeContext] || manualFields[part];
        if (!isFilled) {
          return (
            <span key={i} className="bg-primary/30 text-primary px-0.5 rounded font-semibold">
              {`{${part}}`}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-sm">{template.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Context note banner */}
          {contextNote && (
            <div className="rounded-lg bg-warning/15 border border-warning/30 p-3 text-sm text-warning-foreground">
              {contextNote}
            </div>
          )}

          {/* Chat bubble preview */}
          <div className="rounded-2xl rounded-tl-sm bg-muted p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {renderHighlightedPreview()}
          </div>

          {/* Manual field inputs */}
          {unfilledFields.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Fill in missing fields:</p>
              {unfilledFields.map((field) => (
                <div key={field}>
                  <Label className="text-xs font-mono text-primary">{`{${field}}`}</Label>
                  <Input
                    value={manualFields[field] || ''}
                    onChange={(e) => handleManualChange(field, e.target.value)}
                    className="mt-0.5 h-8 text-sm"
                    placeholder={`Enter ${field}...`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Editable message */}
          <div>
            <Label className="text-xs">Edit message</Label>
            <Textarea
              value={editedMessage}
              onChange={(e) => {
                userEditedRef.current = true;
                setEditedMessage(e.target.value);
              }}
              className="mt-1 min-h-[100px] text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button onClick={handleCopy} className="flex-1 min-h-[44px]">
              {copied ? <ClipboardCheck className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied + Logged' : 'Copy to Clipboard'}
            </Button>
            <CopyPhoneButton bookingId={bookingId} />
          </div>

          {/* Change Script link */}
          {onChangeScript && (
            <button
              onClick={onChangeScript}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline py-1"
            >
              Change Script
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
