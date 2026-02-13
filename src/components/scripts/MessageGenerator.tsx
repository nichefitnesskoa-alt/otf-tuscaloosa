import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Copy, ClipboardCheck, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ScriptTemplate } from '@/hooks/useScriptTemplates';
import { useLogScriptSent } from '@/hooks/useScriptSendLog';
import { useAuth } from '@/context/AuthContext';

interface MergeContext {
  'first-name'?: string;
  'last-name'?: string;
  'sa-name'?: string;
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

  const fullContext: MergeContext = useMemo(() => ({
    'location-name': 'Tuscaloosa',
    'sa-name': user?.name,
    ...mergeContext,
  }), [mergeContext, user]);

  const templateBody = bodyOverride || template.body;
  const unfilledFields = useMemo(() => extractUnfilledFields(templateBody, fullContext), [templateBody, fullContext]);
  const [manualFields, setManualFields] = useState<Record<string, string>>({});
  const [editedMessage, setEditedMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      const applied = applyMergeFields(templateBody, fullContext, {});
      setEditedMessage(applied);
      setManualFields({});
      setCopied(false);
    }
  }, [open, templateBody, fullContext]);

  const handleManualChange = (field: string, value: string) => {
    const newManual = { ...manualFields, [field]: value };
    setManualFields(newManual);
    setEditedMessage(applyMergeFields(templateBody, fullContext, newManual));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedMessage);
    setCopied(true);
    toast({ title: 'Copied!', description: 'Message copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLog = async () => {
    try {
      await logSent.mutateAsync({
        template_id: template.id,
        lead_id: leadId || null,
        booking_id: bookingId || null,
        sent_by: user?.name || 'Unknown',
        message_body_sent: editedMessage,
        sequence_step_number: template.sequence_order || null,
      });

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

      toast({ title: 'Logged as sent' });
      onLogged?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error logging', description: e.message, variant: 'destructive' });
    }
  };

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
              onChange={(e) => setEditedMessage(e.target.value)}
              className="mt-1 min-h-[100px] text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button onClick={handleCopy} className="flex-1">
              {copied ? <ClipboardCheck className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Button>
            <Button variant="outline" onClick={handleLog} disabled={logSent.isPending}>
              <Send className="w-4 h-4 mr-1" /> Log as Sent
            </Button>
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
