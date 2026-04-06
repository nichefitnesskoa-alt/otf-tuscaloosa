/**
 * Reusable drawer for browsing and sending scripts.
 * Used in: New Leads, Shift Tasks, Follow-Up cards.
 *
 * Props:
 * - open / onOpenChange: drawer visibility
 * - leadId, bookingId: nullable — for auto-logging
 * - leadName, leadPhone: display in header (optional)
 * - categoryFilter: single slug or array of slugs to pre-filter (optional)
 * - saName: current SA name for logging
 */
import { useState, useEffect, useMemo } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Phone, Copy, Check, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScriptTemplates, ScriptTemplate } from '@/hooks/useScriptTemplates';
import { useScriptCategoryOptions } from '@/hooks/useScriptCategories';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScriptSendDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string | null;
  bookingId?: string | null;
  leadName?: string | null;
  leadPhone?: string | null;
  categoryFilter?: string | string[] | null;
  saName: string;
}

export function ScriptSendDrawer({
  open,
  onOpenChange,
  leadId = null,
  bookingId = null,
  leadName = null,
  leadPhone = null,
  categoryFilter = null,
  saName,
}: ScriptSendDrawerProps) {
  const { data: templates = [] } = useScriptTemplates();
  const { options: categoryOptions } = useScriptCategoryOptions();

  const filterSlugs = useMemo(() => {
    if (!categoryFilter) return null;
    return Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter];
  }, [categoryFilter]);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [phoneCopied, setPhoneCopied] = useState(false);

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setSelectedCategory('');
      setCopiedId(null);
      setPhoneCopied(false);
    }
  }, [open]);

  // Available categories based on filter
  const availableCategories = useMemo(() => {
    if (!filterSlugs) return categoryOptions;
    return categoryOptions.filter(c => filterSlugs.includes(c.value));
  }, [categoryOptions, filterSlugs]);

  // Filtered templates
  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (filterSlugs && !filterSlugs.includes(t.category)) return false;
      if (selectedCategory && t.category !== selectedCategory) return false;
      return t.is_active;
    });
  }, [templates, filterSlugs, selectedCategory]);

  const resolveMergeFields = (body: string) => {
    let resolved = body;
    if (leadName) {
      const firstName = leadName.split(' ')[0] || '';
      resolved = resolved.replace(/\{first-name\}/gi, firstName);
      resolved = resolved.replace(/\{name\}/gi, leadName);
    } else {
      resolved = resolved.replace(/\{first-name\}/gi, '[Name]');
      resolved = resolved.replace(/\{name\}/gi, '[Name]');
    }
    resolved = resolved.replace(/\{sa-name\}/gi, saName || '[SA Name]');
    resolved = resolved.replace(/\{sa-first-name\}/gi, saName?.split(' ')[0] || '[SA Name]');
    resolved = resolved.replace(/\{coach-name\}/gi, '[Coach Name]');
    resolved = resolved.replace(/\{coach-first-name\}/gi, '[Coach Name]');
    resolved = resolved.replace(/\{today\/tomorrow\}/gi, '[Day]');
    resolved = resolved.replace(/\{day\}/gi, '[Day]');
    resolved = resolved.replace(/\{time\}/gi, '[Time]');
    resolved = resolved.replace(/\{location-name\}/gi, 'Tuscaloosa');
    resolved = resolved.replace(/\{questionnaire-link\}/gi, '[Questionnaire Link]');
    return resolved;
  };

  const handleCopy = async (template: ScriptTemplate) => {
    const resolved = resolveMergeFields(template.body);
    await navigator.clipboard.writeText(resolved);
    setCopiedId(template.id);

    // Auto-log to script_send_log
    try {
      await supabase.from('script_send_log').insert({
        template_id: template.id,
        lead_id: leadId || null,
        booking_id: bookingId || null,
        sent_by: saName,
        message_body_sent: resolved,
        sequence_step_number: template.sequence_order,
      } as any);
    } catch (err) {
      console.error('Failed to log script send:', err);
    }

    // Also log to script_actions
    try {
      await (supabase as any).from('script_actions').insert({
        action_type: 'script_sent',
        completed_by: saName,
        booking_id: bookingId || null,
        template_id: template.id,
      });
    } catch {}

    // Close after 2 seconds
    setTimeout(() => {
      setCopiedId(null);
      onOpenChange(false);
    }, 2000);
  };

  const handleCopyPhone = async () => {
    if (!leadPhone) return;
    await navigator.clipboard.writeText(leadPhone);
    setPhoneCopied(true);
    toast.success('Phone copied!');
    setTimeout(() => setPhoneCopied(false), 2000);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base">
            {leadName ? `Send Script — ${leadName}` : 'Send Script'}
          </DrawerTitle>
          {leadPhone && (
            <div className="flex items-center gap-2 mt-1">
              <a href={`tel:${leadPhone}`} className="text-sm text-primary underline flex items-center gap-1 cursor-pointer">
                <Phone className="w-3.5 h-3.5" />
                {leadPhone}
              </a>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1 cursor-pointer min-h-[44px]"
                onClick={handleCopyPhone}
              >
                {phoneCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {phoneCopied ? 'Copied!' : 'Copy Phone'}
              </Button>
            </div>
          )}
        </DrawerHeader>

        {/* Category pills */}
        {availableCategories.length > 1 && (
          <div className="px-4 pb-2">
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
                {availableCategories.map(cat => (
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
          </div>
        )}

        {/* Script list */}
        <ScrollArea className="flex-1 px-4 pb-4 max-h-[55vh]">
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No scripts found for this category.</p>
            ) : (
              filtered.map(t => {
                const isCopied = copiedId === t.id;
                const preview = resolveMergeFields(t.body);
                const truncated = preview.length > 100 ? preview.slice(0, 100) + '...' : preview;

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
                        <>
                          <Check className="w-4 h-4" />
                          Copied + Logged!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy to Clipboard
                        </>
                      )}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
