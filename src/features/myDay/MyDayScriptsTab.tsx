/**
 * Scripts tab for My Day — inline script browser.
 * Shows all categories + templates with copy-to-clipboard + auto-log.
 */
import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useScriptTemplates, ScriptTemplate } from '@/hooks/useScriptTemplates';
import { useScriptCategoryOptions } from '@/hooks/useScriptCategories';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MyDayScriptsTab() {
  const { user } = useAuth();
  const { data: templates = [], isLoading } = useScriptTemplates();
  const { options: categoryOptions } = useScriptCategoryOptions();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (!t.is_active) return false;
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [templates, selectedCategory, search]);

  const resolvePlaceholders = (body: string) => {
    let resolved = body;
    resolved = resolved.replace(/\{first-name\}/gi, '[Member name]');
    resolved = resolved.replace(/\{name\}/gi, '[Member name]');
    resolved = resolved.replace(/\{sa-name\}/gi, user?.name?.split(' ')[0] || '[SA Name]');
    resolved = resolved.replace(/\{sa-first-name\}/gi, user?.name?.split(' ')[0] || '[SA Name]');
    resolved = resolved.replace(/\{first-intro-coach-name\}/gi, '[Coach name]');
    resolved = resolved.replace(/\{first-intro-coach-full-name\}/gi, '[Coach name]');
    resolved = resolved.replace(/\{coach-name\}/gi, '[Coach name]');
    resolved = resolved.replace(/\{coach-first-name\}/gi, '[Coach name]');
    resolved = resolved.replace(/\{today\/tomorrow\}/gi, '[Day]');
    resolved = resolved.replace(/\{day\}/gi, '[Day]');
    resolved = resolved.replace(/\{time\}/gi, '[Time]');
    resolved = resolved.replace(/\{location-name\}/gi, 'Tuscaloosa');
    resolved = resolved.replace(/\{questionnaire-link\}/gi, '[Questionnaire Link]');
    return resolved;
  };

  const handleCopy = async (template: ScriptTemplate) => {
    const resolved = resolvePlaceholders(template.body);
    await navigator.clipboard.writeText(resolved);
    setCopiedId(template.id);

    // Auto-log
    try {
      await supabase.from('script_send_log').insert({
        template_id: template.id,
        lead_id: null,
        booking_id: null,
        sent_by: user?.name || 'Unknown',
        message_body_sent: resolved,
        sequence_step_number: template.sequence_order,
      } as any);
    } catch {}

    try {
      await (supabase as any).from('script_actions').insert({
        action_type: 'script_sent',
        completed_by: user?.name || 'Unknown',
        template_id: template.id,
      });
    } catch {}

    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Script Library</h2>
        <p className="text-xs text-muted-foreground">Browse and copy messaging scripts. Merge fields show as placeholders.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search scripts..."
          className="pl-8"
        />
      </div>

      {/* Category pills */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-1">
          <button
            onClick={() => setSelectedCategory('')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer min-h-[36px]',
              !selectedCategory
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
            )}
          >
            All
          </button>
          {categoryOptions.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer min-h-[36px]',
                selectedCategory === cat.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Template list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No scripts found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const isCopied = copiedId === t.id;
            const preview = resolvePlaceholders(t.body);
            const truncated = preview.length > 80 ? preview.slice(0, 80) + '...' : preview;

            return (
              <div key={t.id} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{t.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{t.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{truncated}</p>
                <Button
                  className={cn(
                    'w-full min-h-[44px] text-[13px] font-medium gap-1.5 cursor-pointer',
                    isCopied
                      ? 'bg-green-600 hover:bg-green-600 text-white'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  )}
                  onClick={() => handleCopy(t)}
                  disabled={isCopied}
                >
                  {isCopied ? (
                    <><Check className="w-4 h-4" /> Copied!</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Copy to Clipboard</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
