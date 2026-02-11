import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useScriptTemplates, ScriptTemplate, SCRIPT_CATEGORIES } from '@/hooks/useScriptTemplates';
import { TemplateCard } from './TemplateCard';
import { MessageGenerator } from './MessageGenerator';
import { TemplateCategoryTabs } from './TemplateCategoryTabs';

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

  const filtered = templates.filter((t) => {
    if (!t.is_active) return false;
    if (selectedCategory && t.category !== selectedCategory) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.body.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No scripts found</p>
              ) : (
                filtered.map((t) => (
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
