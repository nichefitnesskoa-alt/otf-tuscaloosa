import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Search, Link2, Check, Sparkles, Copy, RefreshCw, Loader2 } from 'lucide-react';
import { useScriptTemplates, ScriptTemplate, SCRIPT_CATEGORIES } from '@/hooks/useScriptTemplates';
import { TemplateCard } from './TemplateCard';
import { MessageGenerator } from './MessageGenerator';
import { TemplateCategoryTabs } from './TemplateCategoryTabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Deterministic tab-to-DB-category mapping
const TAB_CATEGORY_MAP: Record<string, string[]> = {
  confirmation: ['booking_confirmation', 'pre_class_reminder', 'day_before_reminder', 'confirmation'],
  questionnaire: ['booking_confirmation', 'pre_class_reminder', 'questionnaire'],
  follow_up: ['no_show', 'post_class_no_close', 'post_class_joined', 'cancel_freeze', 'follow_up'],
  outreach: ['web_lead', 'cold_lead', 'ig_dm', 'referral_ask', 'promo', 'outreach'],
  web_lead: ['web_lead'],
  cold_lead: ['cold_lead'],
  ig_dm: ['ig_dm'],
};

interface MergeContext {
  'first-name'?: string;
  'last-name'?: string;
  'sa-name'?: string;
  'coach-name'?: string;
  'coach-first-name'?: string;
  day?: string;
  time?: string;
  'today/tomorrow'?: string;
  'questionnaire-link'?: string;
  'friend-questionnaire-link'?: string;
  'location-name'?: string;
}

interface ScriptPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedCategories: string[];
  mergeContext: MergeContext;
  leadId?: string;
  bookingId?: string;
  onLogged?: () => void;
  questionnaireId?: string;
  friendQuestionnaireId?: string;
  onQuestionnaireSent?: () => void;
  onFriendQuestionnaireSent?: () => void;
}

export function ScriptPickerSheet({ open, onOpenChange, suggestedCategories, mergeContext, leadId, bookingId, onLogged, questionnaireId, friendQuestionnaireId, onQuestionnaireSent, onFriendQuestionnaireSent }: ScriptPickerSheetProps) {
  const [selectedCategory, setSelectedCategory] = useState(suggestedCategories[0] || '');
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiScript, setAiScript] = useState('');
  const [aiCategory, setAiCategory] = useState(suggestedCategories[0] || 'follow_up');
  const { data: templates = [] } = useScriptTemplates();

  // Member context state — populated when bookingId is provided
  const [memberCtx, setMemberCtx] = useState<{
    name: string;
    goal: string | null;
    obstacle: string | null;
    why: string | null;
    isSecondIntro?: boolean;
  } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  // Auto-resolved questionnaire data from the booking
  const [resolvedQuestionnaireId, setResolvedQuestionnaireId] = useState<string | undefined>(undefined);
  const [resolvedQuestionnaireUrl, setResolvedQuestionnaireUrl] = useState<string | undefined>(undefined);

  const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';

  useEffect(() => {
    if (!open || !bookingId) {
      setMemberCtx(null);
      setResolvedQuestionnaireId(undefined);
      setResolvedQuestionnaireUrl(undefined);
      return;
    }
    let cancelled = false;
    const fetchCtx = async () => {
      setCtxLoading(true);
      try {
        // Fetch the booking row
        const { data: booking } = await supabase
          .from('intros_booked')
          .select('member_name, lead_source, originating_booking_id')
          .eq('id', bookingId)
          .maybeSingle();

        if (cancelled || !booking) return;

        // Fetch questionnaire by booking_id
        let q = (await supabase
          .from('intro_questionnaires')
          .select('id, slug, q1_fitness_goal, q3_obstacle, q5_emotional_driver')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()).data;

        // Fallback: if no Q linked by booking_id, try matching by name
        if (!q && booking.member_name) {
          const nameParts = booking.member_name.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          if (firstName) {
            let nameQuery = supabase
              .from('intro_questionnaires')
              .select('id, slug, q1_fitness_goal, q3_obstacle, q5_emotional_driver, booking_id')
              .ilike('client_first_name', firstName);
            if (lastName) nameQuery = nameQuery.ilike('client_last_name', lastName);
            const { data: nameMatches } = await nameQuery
              .order('created_at', { ascending: false })
              .limit(5);
            // Pick the first unlinked or matching record
            const match = (nameMatches || []).find((m: any) => !m.booking_id || m.booking_id === bookingId);
            if (match) {
              q = match as any;
              // Auto-link: fire-and-forget
              supabase.from('intro_questionnaires')
                .update({ booking_id: bookingId })
                .eq('id', match.id)
                .then(() => {});
            }
          }
        }

        if (cancelled) return;

        const trim = (s: string | null | undefined, max = 45) =>
          s ? (s.length > max ? s.slice(0, max) + '…' : s) : null;

        setMemberCtx({
          name: booking.member_name,
          goal: q ? trim(q.q1_fitness_goal) : null,
          obstacle: q ? trim(q.q3_obstacle) : null,
          why: q ? trim(q.q5_emotional_driver) : null,
          isSecondIntro: !!booking.originating_booking_id,
        });

        // Store resolved questionnaire URL for auto-injection into script body
        if (q) {
          setResolvedQuestionnaireId(q.id);
          const slug = (q as any).slug || q.id;
          setResolvedQuestionnaireUrl(`${PUBLISHED_URL}/q/${slug}`);
        }
      } finally {
        if (!cancelled) setCtxLoading(false);
      }
    };
    fetchCtx();
    return () => { cancelled = true; };
  }, [open, bookingId]);

  const allActive = templates.filter(t => t.is_active !== false);

  const filtered = allActive.filter((t) => {
    if (selectedCategory) {
      const allowed = TAB_CATEGORY_MAP[selectedCategory];
      if (allowed && allowed.length) {
        // Match against DB category, category_canon, or the tab key itself
        const cat = (t.category || '').toLowerCase();
        const canon = ((t as any).category_canon || '').toLowerCase();
        if (!allowed.includes(cat) && !allowed.includes(canon) && cat !== selectedCategory && canon !== selectedCategory) return false;
      }
    }
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // If tab has 0 results, fall back to showing all active
  const showFallback = filtered.length === 0 && !!selectedCategory;
  const displayTemplates = showFallback ? allActive : filtered;

  // Show suggested categories as tabs
  const suggestedCatLabels = suggestedCategories.map(
    (c) => SCRIPT_CATEGORIES.find((sc) => sc.value === c)
  ).filter(Boolean);

  const handleAiGenerate = async () => {
    setAiGenerating(true);
    setAiScript('');
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          personName: memberCtx?.name || mergeContext['first-name'] || '',
          goal: memberCtx?.goal || '',
          why: memberCtx?.why || '',
          obstacle: memberCtx?.obstacle || '',
          fitnessLevel: '',
          objection: '',
          leadSource: '',
          scriptCategory: SCRIPT_CATEGORIES.find(c => c.value === aiCategory)?.label || aiCategory,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAiScript(data.script || 'No script generated');
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      toast.error(`AI generation failed: ${msg}`);
      console.error('AI generate error:', err);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleUseAiScript = async () => {
    if (!aiScript) return;
    await navigator.clipboard.writeText(aiScript);
    toast.success('Script copied to clipboard');
    // Log as sent
    if (bookingId) {
      await supabase.from('script_send_log').insert({
        template_id: '00000000-0000-0000-0000-000000000000',
        booking_id: bookingId,
        sent_by: mergeContext['sa-name'] || 'Unknown',
        message_body_sent: aiScript,
      } as any);
    }
    setAiPanelOpen(false);
    setAiScript('');
    onLogged?.();
  };

  return (
    <>
      <Drawer open={open && !selectedTemplate && !aiPanelOpen} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg">Select Script</DrawerTitle>
          </DrawerHeader>

          {/* AI Generate button */}
          <div className="mx-4 mb-2">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 border-primary/30" onClick={() => setAiPanelOpen(true)}>
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              ✨ AI Generate Script
            </Button>
          </div>

          {/* Member Context Panel — only shown when bookingId is provided */}
          {bookingId && (
            <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-muted/60 border text-xs space-y-0.5">
              <p className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Member Context</p>
              {ctxLoading ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : memberCtx ? (
                <>
                  <div className="flex gap-1"><span className="text-muted-foreground w-16 shrink-0">Name:</span><span className="font-medium">{memberCtx.name}</span></div>
                  <div className="flex gap-1"><span className="text-muted-foreground w-16 shrink-0">Visit:</span><span className="font-medium">{memberCtx.isSecondIntro ? '2nd Intro' : '1st Intro'}</span></div>
                  <div className="flex gap-1"><span className="text-muted-foreground w-16 shrink-0">Goal:</span><span>{memberCtx.goal ?? 'Ask before class'}</span></div>
                  <div className="flex gap-1"><span className="text-muted-foreground w-16 shrink-0">Obstacle:</span><span>{memberCtx.obstacle ?? 'Ask before class'}</span></div>
                  <div className="flex gap-1"><span className="text-muted-foreground w-16 shrink-0">Why:</span><span>{memberCtx.why ?? 'Ask before class'}</span></div>
                </>
              ) : null}
            </div>
          )}

          <div className="px-4 space-y-3">
            {/* Category filter */}
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-1">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                    !selectedCategory
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </button>
                {SCRIPT_CATEGORIES.map((sc) => {
                  const isSuggested = suggestedCategories.includes(sc.value);
                  return (
                    <button
                      key={sc.value}
                      onClick={() => setSelectedCategory(sc.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                        selectedCategory === sc.value
                          ? 'bg-primary text-primary-foreground'
                          : isSuggested
                            ? 'bg-accent text-accent-foreground hover:text-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search scripts..."
                className="pl-8 h-9"
              />
            </div>
          </div>

          <ScrollArea className="px-4 pb-6 flex-1 mt-3">
            <div className="space-y-2">
              {showFallback && (
                <p className="text-xs text-muted-foreground text-center pb-2">No templates tagged for this tab yet, showing All</p>
              )}
              {displayTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No scripts found</p>
              ) : (
                displayTemplates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isAdmin={false}
                    onClick={() => setSelectedTemplate(t)}
                  />
                ))
              )}
            </div>

            {/* Copy Q link only — low-priority, 1st intros only, only when URL exists */}
            {!memberCtx?.isSecondIntro && resolvedQuestionnaireUrl && (
              <div className="pt-2 border-t border-dashed flex justify-center">
                <button
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 py-1"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(resolvedQuestionnaireUrl);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                      toast.success('Link copied');
                    } catch {
                      toast.error('Failed to copy');
                    }
                  }}
                >
                  {linkCopied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                  {linkCopied ? 'Copied!' : 'Copy questionnaire link only'}
                </button>
              </div>
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {selectedTemplate && (
        <MessageGenerator
          open={!!selectedTemplate}
          onOpenChange={(o) => { if (!o) setSelectedTemplate(null); }}
          template={selectedTemplate}
          mergeContext={{
            ...mergeContext,
            // Auto-inject the questionnaire URL when we've resolved it from the booking
            ...(resolvedQuestionnaireUrl && !mergeContext['questionnaire-link']
              ? { 'questionnaire-link': resolvedQuestionnaireUrl }
              : {}),
          }}
          leadId={leadId}
          bookingId={bookingId}
          onLogged={onLogged}
          questionnaireId={questionnaireId ?? resolvedQuestionnaireId}
          friendQuestionnaireId={friendQuestionnaireId}
          onQuestionnaireSent={onQuestionnaireSent}
          onFriendQuestionnaireSent={onFriendQuestionnaireSent}
        />
      )}

      {/* AI Panel Drawer */}
      <Drawer open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg">✨ AI Script Generator</DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">
              Powered by Claude — writes in Koa's voice
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="px-4 pb-6 flex-1">
            <div className="space-y-4">
              {/* Category selector */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Script Category</label>
                <Select value={aiCategory} onValueChange={setAiCategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmation">Confirmation</SelectItem>
                    <SelectItem value="questionnaire">Questionnaire Send</SelectItem>
                    <SelectItem value="follow_up_1">Follow-up Touch 1</SelectItem>
                    <SelectItem value="follow_up_2">Follow-up Touch 2</SelectItem>
                    <SelectItem value="follow_up_3">Follow-up Touch 3</SelectItem>
                    <SelectItem value="no_show">No-show Outreach</SelectItem>
                    <SelectItem value="objection">Objection Handling</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pre-filled context */}
              <div className="rounded-lg bg-muted/60 border p-3 text-xs space-y-0.5">
                <p className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Context</p>
                <div className="flex gap-1">
                  <span className="text-muted-foreground w-16 shrink-0">Name:</span>
                  <span className="font-medium">{memberCtx?.name || mergeContext['first-name'] || '—'}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground w-16 shrink-0">Goal:</span>
                  <span>{memberCtx?.goal || 'Not specified'}</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground w-16 shrink-0">Objection:</span>
                  <span>{memberCtx?.obstacle || 'None'}</span>
                </div>
              </div>

              {/* Generate buttons */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handleAiGenerate}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating…</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-1" /> Generate Script</>
                  )}
                </Button>
                {aiScript && (
                  <Button variant="outline" size="sm" onClick={handleAiGenerate} disabled={aiGenerating}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate
                  </Button>
                )}
              </div>

              {/* Generated script */}
              {aiScript && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Generated Script (editable)</label>
                  <Textarea
                    value={aiScript}
                    onChange={(e) => setAiScript(e.target.value)}
                    className="min-h-[120px] text-sm"
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                {aiScript && (
                  <Button className="flex-1" onClick={handleUseAiScript}>
                    <Copy className="w-4 h-4 mr-1" /> Use This Script
                  </Button>
                )}
                <Button variant="outline" onClick={() => { setAiPanelOpen(false); setAiScript(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}
