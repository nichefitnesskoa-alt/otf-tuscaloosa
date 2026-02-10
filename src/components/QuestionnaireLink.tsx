import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateUniqueSlug } from '@/lib/utils';

const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';

interface QuestionnaireLinkProps {
  bookingId: string;
  memberName: string;
  introDate: string;
  introTime: string;
  questionnaireId?: string;
  questionnaireStatus?: 'not_sent' | 'sent' | 'completed';
  onQuestionnaireCreated: (id: string) => void;
  onStatusChange: (status: 'not_sent' | 'sent' | 'completed') => void;
}

export default function QuestionnaireLink({
  bookingId,
  memberName,
  introDate,
  introTime,
  questionnaireId,
  questionnaireStatus = 'not_sent',
  onQuestionnaireCreated,
  onStatusChange,
}: QuestionnaireLinkProps) {
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const nameParts = memberName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  const hasMinData = firstName.length >= 2 && introDate;
  const syncRef = useRef<NodeJS.Timeout>();
  const [slug, setSlug] = useState<string | null>(null);

  // Auto-create questionnaire when we have minimum data and no ID yet
  const createQuestionnaire = useCallback(async () => {
    if (!hasMinData || questionnaireId || creating || failed) return;
    setCreating(true);
    const newId = crypto.randomUUID();
    const newSlug = await generateUniqueSlug(firstName, lastName, supabase);
    const { error } = await supabase.from('intro_questionnaires').insert({
      id: newId,
      booking_id: null,
      client_first_name: firstName,
      client_last_name: lastName,
      scheduled_class_date: introDate,
      scheduled_class_time: introTime || null,
      status: 'not_sent',
      slug: newSlug || null,
    } as any);
    setCreating(false);
    if (error) {
      console.error('Error creating questionnaire:', error);
      toast.error('Failed to generate questionnaire link');
      setFailed(true);
      return;
    }
    setSlug(newSlug);
    onQuestionnaireCreated(newId);
  }, [hasMinData, questionnaireId, creating, failed, firstName, lastName, introDate, introTime, onQuestionnaireCreated]);

  useEffect(() => {
    createQuestionnaire();
  }, [createQuestionnaire]);

  // Sync name/date/time changes back to existing questionnaire record
  useEffect(() => {
    if (!questionnaireId || !firstName) return;
    if (syncRef.current) clearTimeout(syncRef.current);
    syncRef.current = setTimeout(async () => {
      const newSlug = await generateUniqueSlug(firstName, lastName, supabase, questionnaireId);
      await supabase.from('intro_questionnaires').update({
        client_first_name: firstName,
        client_last_name: lastName,
        scheduled_class_date: introDate,
        scheduled_class_time: introTime || null,
        slug: newSlug || null,
      } as any).eq('id', questionnaireId);
      setSlug(newSlug);
    }, 800);
    return () => { if (syncRef.current) clearTimeout(syncRef.current); };
  }, [questionnaireId, firstName, lastName, introDate, introTime]);

  // Fetch slug for existing questionnaire
  useEffect(() => {
    if (!questionnaireId || slug) return;
    (async () => {
      const { data } = await supabase
        .from('intro_questionnaires')
        .select('slug' as any)
        .eq('id', questionnaireId)
        .maybeSingle();
      if ((data as any)?.slug) setSlug((data as any).slug);
    })();
  }, [questionnaireId]);

  // Poll for completion status
  useEffect(() => {
    if (!questionnaireId || questionnaireStatus === 'completed') return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('intro_questionnaires')
        .select('status')
        .eq('id', questionnaireId)
        .maybeSingle();
      if (data?.status === 'completed') {
        onStatusChange('completed');
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [questionnaireId, questionnaireStatus, onStatusChange]);

  if (!hasMinData) return null;
  if (creating) return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
      <Loader2 className="w-3 h-3 animate-spin" /> Generating questionnaire link...
    </div>
  );
  if (!questionnaireId) return null;

  const link = slug ? `${PUBLISHED_URL}/q/${slug}` : `${PUBLISHED_URL}/q/${questionnaireId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (questionnaireStatus === 'not_sent') {
        await supabase.from('intro_questionnaires').update({ status: 'sent' }).eq('id', questionnaireId);
        onStatusChange('sent');
      }
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const statusBadge = () => {
    switch (questionnaireStatus) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 py-0">Completed</Badge>;
      case 'sent':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px] px-1.5 py-0">Sent</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Not Sent</Badge>;
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap py-1">
      <span className="text-[10px] font-medium text-muted-foreground">Pre-Intro Q:</span>
      {statusBadge()}
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
      >
        Link <ExternalLink className="w-2.5 h-2.5" />
      </a>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5"
        onClick={copyLink}
      >
        {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      </Button>
    </div>
  );
}
