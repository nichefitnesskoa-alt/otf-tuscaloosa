import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, User, CalendarDays, ArrowRight, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useScriptTemplates, ScriptTemplate, SCRIPT_CATEGORIES } from '@/hooks/useScriptTemplates';
import { useScriptSendLog } from '@/hooks/useScriptSendLog';
import { TemplateCard } from './TemplateCard';
import { MessageGenerator } from './MessageGenerator';
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns';

interface ClientSearchScriptPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedPerson?: SearchResult;
}

export type SearchResult = {
  type: 'lead' | 'booking';
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  stage?: string;
  source?: string;
  classDate?: string;
  classTime?: string;
  bookingStatus?: string;
  questionnaireSlug?: string;
  detail: string;
};

function useSearchPeople(query: string) {
  return useQuery({
    queryKey: ['people_search', query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const results: SearchResult[] = [];
      const q = `%${query}%`;

      // Search leads
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .or(`first_name.ilike.${q},last_name.ilike.${q}`)
        .limit(10);

      if (leads) {
        for (const l of leads) {
          results.push({
            type: 'lead',
            id: l.id,
            name: `${l.first_name} ${l.last_name}`,
            firstName: l.first_name,
            lastName: l.last_name,
            stage: l.stage,
            source: l.source,
            detail: `Lead · ${l.stage} · ${l.source}`,
          });
        }
      }

      // Search bookings
      const { data: bookings } = await supabase
        .from('intros_booked')
        .select('*')
        .ilike('member_name', q)
        .is('deleted_at', null)
        .limit(10);

      if (bookings) {
        for (const b of bookings) {
          const parts = b.member_name.split(' ');
          // Also check for questionnaire
          const { data: questionnaire } = await supabase
            .from('intro_questionnaires')
            .select('slug')
            .eq('booking_id', b.id)
            .maybeSingle();

          results.push({
            type: 'booking',
            id: b.id,
            name: b.member_name,
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ') || '',
            classDate: b.class_date,
            classTime: b.intro_time || undefined,
            bookingStatus: b.booking_status || 'Active',
            source: b.lead_source,
            questionnaireSlug: (questionnaire as any)?.slug || undefined,
            detail: `Booking · ${b.class_date}${b.intro_time ? ' at ' + b.intro_time : ''} · ${b.booking_status || 'Active'}`,
          });
        }
      }

      return results;
    },
  });
}

function getSuggestedCategories(result: SearchResult, sendLogCount: number): string[] {
  if (result.type === 'lead') {
    const cats: string[] = [];
    if (result.source?.toLowerCase().includes('instagram')) cats.push('ig_dm');
    cats.push('web_lead');
    const ageDays = result.stage === 'new' ? 0 : 31; // approximate
    if (ageDays > 30) cats.push('cold_lead');
    return cats;
  }

  // booking
  const cats: string[] = [];
  if (result.bookingStatus === 'No-show') {
    cats.push('no_show');
  } else if (result.classDate) {
    const classDate = parseISO(result.classDate);
    const daysUntil = differenceInDays(classDate, new Date());
    if (daysUntil > 0) {
      cats.push('booking_confirmation', 'pre_class_reminder');
    } else {
      cats.push('post_class_no_close', 'post_class_joined');
    }
  } else {
    cats.push('booking_confirmation');
  }
  cats.push('referral_ask', 'birthday_milestone');
  return cats;
}

export function ClientSearchScriptPicker({ open, onOpenChange, preSelectedPerson }: ClientSearchScriptPickerProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<SearchResult | null>(preSelectedPerson || null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualFirstName, setManualFirstName] = useState('');
  const [manualLastName, setManualLastName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Sync preSelectedPerson when dialog opens
  useEffect(() => {
    if (preSelectedPerson && open) {
      setSelectedPerson(preSelectedPerson);
    }
  }, [open, preSelectedPerson]);

  const { data: searchResults = [], isLoading: searching } = useSearchPeople(searchQuery);
  const { data: templates = [] } = useScriptTemplates();
  const { data: sendLogs = [] } = useScriptSendLog({
    leadId: selectedPerson?.type === 'lead' ? selectedPerson.id : undefined,
    bookingId: selectedPerson?.type === 'booking' ? selectedPerson.id : undefined,
  });

  const suggestedCats = selectedPerson ? getSuggestedCategories(selectedPerson, sendLogs.length) : [];

  const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';

  const mergeContext = useMemo(() => {
    if (manualMode) {
      return {
        'first-name': manualFirstName || undefined,
        'last-name': manualLastName || undefined,
        'sa-name': user?.name,
        'location-name': 'Tuscaloosa',
      };
    }
    if (!selectedPerson) return { 'sa-name': user?.name, 'location-name': 'Tuscaloosa' };

    const ctx: Record<string, string | undefined> = {
      'first-name': selectedPerson.firstName,
      'last-name': selectedPerson.lastName,
      'sa-name': user?.name,
      'location-name': 'Tuscaloosa',
    };

    if (selectedPerson.classDate) {
      const d = parseISO(selectedPerson.classDate);
      ctx.day = format(d, 'EEEE');
      if (isToday(d)) ctx['today/tomorrow'] = 'today';
      else if (isTomorrow(d)) ctx['today/tomorrow'] = 'tomorrow';
      else ctx['today/tomorrow'] = format(d, 'EEEE');
    }
    if (selectedPerson.classTime) ctx.time = selectedPerson.classTime;
    if (selectedPerson.questionnaireSlug) {
      ctx['questionnaire-link'] = `${PUBLISHED_URL}/q/${selectedPerson.questionnaireSlug}`;
    }

    return ctx;
  }, [selectedPerson, manualMode, manualFirstName, manualLastName, user]);

  // Filter templates
  const recommended = templates.filter(t => t.is_active && suggestedCats.includes(t.category));
  const allFiltered = templates.filter(t => {
    if (!t.is_active) return false;
    if (selectedCategory && t.category !== selectedCategory) return false;
    return true;
  });

  const handleReset = () => {
    setSelectedPerson(null);
    setSearchQuery('');
    setManualMode(false);
    setManualFirstName('');
    setManualLastName('');
    setSelectedCategory('');
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      handleReset();
      setSelectedTemplate(null);
    }
    onOpenChange(o);
  };

  // Message generator (separate dialog)
  if (selectedTemplate) {
    return (
      <MessageGenerator
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedTemplate(null);
          }
          if (!o) handleClose(false);
        }}
        template={selectedTemplate}
        mergeContext={mergeContext}
        leadId={selectedPerson?.type === 'lead' ? selectedPerson.id : undefined}
        bookingId={selectedPerson?.type === 'booking' ? selectedPerson.id : undefined}
      />
    );
  }

  // Single Dialog for search + manual + script selection steps
  const step = !selectedPerson && !manualMode ? 'search' : (manualMode && !selectedPerson ? 'manual' : 'scripts');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        {step === 'search' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Generate Script — Who is this for?</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name..."
                  className="pl-8"
                  autoFocus
                />
              </div>

              {searching && <p className="text-xs text-muted-foreground text-center py-4">Searching...</p>}

              {searchResults.length > 0 && (
                <ScrollArea className="max-h-60">
                  <div className="space-y-1">
                    {['lead', 'booking'].map(type => {
                      const group = searchResults.filter(r => r.type === type);
                      if (group.length === 0) return null;
                      return (
                        <div key={type}>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase px-1 py-1">
                            {type === 'lead' ? 'Leads' : 'Bookings'}
                          </p>
                          {group.map(r => (
                            <button
                              key={`${r.type}-${r.id}`}
                              onClick={() => setSelectedPerson(r)}
                              className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2"
                            >
                              {r.type === 'lead' ? (
                                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{r.name}</p>
                                <p className="text-[11px] text-muted-foreground">{r.detail}</p>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No results found</p>
              )}

              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={() => setManualMode(true)}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Enter details manually
              </Button>
            </div>
          </>
        )}

        {step === 'manual' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Generate Script — Manual Entry</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">First Name</Label>
                  <Input value={manualFirstName} onChange={e => setManualFirstName(e.target.value)} placeholder="First" />
                </div>
                <div>
                  <Label className="text-xs">Last Name</Label>
                  <Input value={manualLastName} onChange={e => setManualLastName(e.target.value)} placeholder="Last" />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {SCRIPT_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(prev => prev === cat.value ? '' : cat.value)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                      selectedCategory === cat.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <ScrollArea className="max-h-60">
                <div className="space-y-2">
                  {allFiltered.map(t => (
                    <TemplateCard key={t.id} template={t} isAdmin={false} onClick={() => setSelectedTemplate(t)} />
                  ))}
                  {allFiltered.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No templates found</p>
                  )}
                </div>
              </ScrollArea>

              <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
                ← Back to search
              </Button>
            </div>
          </>
        )}

        {step === 'scripts' && selectedPerson && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Scripts for {selectedPerson.firstName}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-semibold">{selectedPerson.name}</p>
                <p className="text-xs text-muted-foreground">{selectedPerson.detail}</p>
              </div>

              {recommended.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Recommended for {selectedPerson.firstName}
                  </p>
                  <div className="space-y-2">
                    {recommended.slice(0, 5).map(t => (
                      <TemplateCard key={t.id} template={t} isAdmin={false} onClick={() => setSelectedTemplate(t)} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">All Scripts</p>
                <ScrollArea className="w-full whitespace-nowrap mb-2">
                  <div className="flex gap-1.5 pb-1">
                    <button
                      onClick={() => setSelectedCategory('')}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors shrink-0 ${
                        !selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      All
                    </button>
                    {SCRIPT_CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(prev => prev === cat.value ? '' : cat.value)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors shrink-0 ${
                          selectedCategory === cat.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </ScrollArea>

                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {allFiltered.map(t => (
                      <TemplateCard key={t.id} template={t} isAdmin={false} onClick={() => setSelectedTemplate(t)} />
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
                ← Back to search
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
