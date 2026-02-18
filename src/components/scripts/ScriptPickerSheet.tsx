import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useScriptTemplates, ScriptTemplate, SCRIPT_CATEGORIES } from '@/hooks/useScriptTemplates';
import { TemplateCard } from './TemplateCard';
import { MessageGenerator } from './MessageGenerator';
import { TemplateCategoryTabs } from './TemplateCategoryTabs';
import { supabase } from '@/integrations/supabase/client';

// Deterministic tab-to-DB-category mapping
const TAB_CATEGORY_MAP: Record<string, string[]> = {
  confirmation: ['booking_confirmation', 'pre_class_reminder', 'day_before_reminder', 'confirmation'],
  questionnaire: ['booking_confirmation', 'pre_class_reminder', 'questionnaire'],
  follow_up: ['no_show', 'post_class_no_close', 'post_class_joined', 'cancel_freeze', 'follow_up'],
  outreach: ['web_lead', 'cold_lead', 'ig_dm', 'referral_ask', 'promo', 'outreach'],
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
  const { data: templates = [] } = useScriptTemplates();

  // Member context state — populated when bookingId is provided
  const [memberCtx, setMemberCtx] = useState<{
    name: string;
    goal: string | null;
    obstacle: string | null;
    why: string | null;
  } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) {
      setMemberCtx(null);
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
        const { data: q } = await supabase
          .from('intro_questionnaires')
          .select('q1_fitness_goal, q3_obstacle, q5_emotional_driver')
          .eq('booking_id', bookingId)
          .maybeSingle();

        if (cancelled) return;

        const trim = (s: string | null | undefined, max = 45) =>
          s ? (s.length > max ? s.slice(0, max) + '…' : s) : null;

        setMemberCtx({
          name: booking.member_name,
          goal: q ? trim(q.q1_fitness_goal) : null,
          obstacle: q ? trim(q.q3_obstacle) : null,
          why: q ? trim(q.q5_emotional_driver) : null,
        });
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

  return (
    <>
      <Drawer open={open && !selectedTemplate} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg">Select Script</DrawerTitle>
          </DrawerHeader>

          {/* Member Context Panel — only shown when bookingId is provided */}
          {bookingId && (
            <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-muted/60 border text-xs space-y-0.5">
              <p className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Member Context</p>
              {ctxLoading ? (
                <p className="text-muted-foreground">Loading…</p>
              ) : memberCtx ? (
                <>
                  <div className="flex gap-1"><span className="text-muted-foreground w-16 shrink-0">Name:</span><span className="font-medium">{memberCtx.name}</span></div>
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
                {suggestedCategories.map((cat) => {
                  const label = SCRIPT_CATEGORIES.find((sc) => sc.value === cat)?.label || cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {suggestedCategories.length > 0 && (
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
                )}
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
          </ScrollArea>
        </DrawerContent>
      </Drawer>

      {selectedTemplate && (
        <MessageGenerator
          open={!!selectedTemplate}
          onOpenChange={(o) => { if (!o) setSelectedTemplate(null); }}
          template={selectedTemplate}
          mergeContext={mergeContext}
          leadId={leadId}
          bookingId={bookingId}
          onLogged={onLogged}
          questionnaireId={questionnaireId}
          friendQuestionnaireId={friendQuestionnaireId}
          onQuestionnaireSent={onQuestionnaireSent}
          onFriendQuestionnaireSent={onFriendQuestionnaireSent}
        />
      )}
    </>
  );
}
