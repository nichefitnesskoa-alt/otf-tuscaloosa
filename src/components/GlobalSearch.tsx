/**
 * GlobalSearch — full-screen search overlay accessible from every page.
 * Searches across: intros_booked, leads, follow_up_queue, intros_run,
 * sales_outside_intro, and vip_sessions members.
 * Results are grouped by category and tapping navigates to the correct tab.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Search, X, ArrowRight, Calendar, Users, DollarSign, Star, Bell, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface SearchResult {
  id: string;
  name: string;
  context: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
  category: 'intros' | 'leads' | 'followups' | 'purchased' | 'vip' | 'sales';
  navigateTo: string;
  navigationState?: Record<string, unknown>;
}

const CATEGORY_META: Record<SearchResult['category'], { label: string; icon: typeof Calendar; color: string }> = {
  intros:   { label: 'Intros',      icon: Calendar,    color: 'text-primary' },
  leads:    { label: 'Leads',       icon: UserCheck,   color: 'text-info' },
  followups:{ label: 'Follow-Ups',  icon: Bell,        color: 'text-warning' },
  purchased:{ label: 'Purchased',   icon: DollarSign,  color: 'text-success' },
  vip:      { label: 'VIP',         icon: Star,        color: 'text-amber-500' },
  sales:    { label: 'Outside Sales', icon: DollarSign, color: 'text-success' },
};

const CATEGORY_ORDER: SearchResult['category'][] = ['intros', 'leads', 'followups', 'purchased', 'vip', 'sales'];

function normalizePhone(p: string) {
  return p.replace(/\D/g, '');
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  // Auto-focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const runSearch = useCallback(async (q: string) => {
    const cleaned = q.replace(/[\t\r\n]+/g, ' ').trim();
    if (cleaned.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const term = cleaned.toLowerCase();
    const likePattern = `%${term}%`;
    const phoneDigits = normalizePhone(term);

    // Split into parts for first+last name matching
    const nameParts = cleaned.split(/\s+/).filter(Boolean);
    const hasMultipleParts = nameParts.length >= 2;

    try {
      // Build leads OR filter — handle "First Last" searches
      let leadsOrFilter = `first_name.ilike.${likePattern},last_name.ilike.${likePattern}`;
      if (phoneDigits.length >= 7) leadsOrFilter += `,phone.ilike.%${phoneDigits}%`;
      if (hasMultipleParts) {
        // Also try: first part matches first_name AND last part matches last_name
        // We can't do AND inside .or(), so we add individual part matches
        for (const part of nameParts) {
          leadsOrFilter += `,first_name.ilike.%${part}%,last_name.ilike.%${part}%`;
        }
      }

      // Parallel queries across all tables
      const [
        introsRes,
        leadsRes,
        followupsRes,
        purchasedRes,
        vipSessionsRes,
        outsideSalesRes,
      ] = await Promise.all([
        // intros_booked
        supabase
          .from('intros_booked')
          .select('id, member_name, class_date, intro_time, booking_status_canon, lead_source, result_canon')
          .or(`member_name.ilike.${likePattern}${phoneDigits.length >= 7 ? `,phone.ilike.%${phoneDigits}%,phone_e164.ilike.%${phoneDigits}%` : ''}`)
          .is('deleted_at', null)
          .order('class_date', { ascending: false })
          .limit(20) as any,

        // leads
        supabase
          .from('leads')
          .select('id, first_name, last_name, phone, email, stage, source')
          .or(leadsOrFilter)
          .limit(10),

        // follow_up_queue (pending/due)
        supabase
          .from('follow_up_queue')
          .select('id, person_name, scheduled_date, touch_number, status, booking_id')
          .ilike('person_name', likePattern)
          .in('status', ['pending', 'overdue'])
          .order('scheduled_date', { ascending: true })
          .limit(10),

        // intros_run — purchased outcomes
        supabase
          .from('intros_run')
          .select('id, member_name, result, buy_date, run_date, result_canon, lead_source')
          .ilike('member_name', likePattern)
          .in('result_canon', ['PURCHASED'])
          .order('buy_date', { ascending: false })
          .limit(10),

        // vip_sessions / intros_booked with is_vip — also fetch phone from vip_registrations
        supabase
          .from('intros_booked')
          .select('id, member_name, class_date, vip_class_name, is_vip, phone')
          .ilike('member_name', likePattern)
          .eq('is_vip', true)
          .is('deleted_at', null)
          .limit(10),

        // sales_outside_intro
        supabase
          .from('sales_outside_intro')
          .select('id, member_name, membership_type, date_closed, lead_source')
          .ilike('member_name', likePattern)
          .order('date_closed', { ascending: false })
          .limit(10),
      ]);

      const found: SearchResult[] = [];

      // Intros booked
      for (const b of (introsRes.data || [])) {
        const dateStr = b.class_date ? format(parseLocalDate(b.class_date), 'MMM d') : '';
        const timeStr = b.intro_time ? ` · ${b.intro_time}` : '';
        const status = b.booking_status_canon === 'ACTIVE' ? 'Active' : b.booking_status_canon || '';
        // Skip VIP — handled separately
        found.push({
          id: b.id,
          name: b.member_name,
          context: `${dateStr}${timeStr} · ${status}`,
          badge: b.booking_status_canon,
          badgeVariant: 'outline',
          category: 'intros',
          navigateTo: '/my-day',
          navigationState: { highlight: b.id },
        });
      }

      // Leads — deduplicate and filter for multi-word relevance
      const seenLeadIds = new Set<string>();
      for (const l of (leadsRes.data || [])) {
        if (seenLeadIds.has(l.id)) continue;
        // For multi-word searches, verify the full name actually contains all parts
        if (hasMultipleParts) {
          const fullName = `${l.first_name} ${l.last_name}`.toLowerCase();
          const allMatch = nameParts.every(p => fullName.includes(p.toLowerCase()));
          if (!allMatch && !(phoneDigits.length >= 7 && normalizePhone(l.phone || '').includes(phoneDigits))) continue;
        }
        seenLeadIds.add(l.id);
        found.push({
          id: l.id,
          name: `${l.first_name} ${l.last_name}`,
          context: `${l.source || 'Lead'} · ${l.stage}`,
          badge: l.stage,
          badgeVariant: l.stage === 'new' ? 'secondary' : 'outline',
          category: 'leads',
          navigateTo: '/pipeline',
          navigationState: { tab: 'leads', highlight: l.id },
        });
      }

      // Follow-ups
      for (const f of (followupsRes.data || [])) {
        const dateStr = f.scheduled_date ? format(parseLocalDate(f.scheduled_date), 'MMM d') : '';
        found.push({
          id: f.id,
          name: f.person_name,
          context: `Touch ${f.touch_number} · Due ${dateStr}`,
          badge: f.status,
          badgeVariant: 'secondary',
          category: 'followups',
          navigateTo: '/my-day',
          navigationState: { tab: 'followups' },
        });
      }

      // Purchased
      for (const r of (purchasedRes.data || [])) {
        const dateStr = (r.buy_date || r.run_date) ? format(parseLocalDate(r.buy_date || r.run_date), 'MMM d') : '';
        found.push({
          id: r.id,
          name: r.member_name,
          context: `${r.result} · ${dateStr}`,
          badge: 'Purchased',
          badgeVariant: 'default',
          category: 'purchased',
          navigateTo: '/pipeline',
          navigationState: { tab: 'purchased' },
        });
      }

      // VIP
      for (const v of (vipSessionsRes.data || [])) {
        const phone = (v as any).phone;
        found.push({
          id: v.id,
          name: v.member_name,
          context: `${v.vip_class_name || 'VIP'}${phone ? ` · 📱 ${phone}` : ''}`,
          badge: 'VIP',
          badgeVariant: 'secondary',
          category: 'vip',
          navigateTo: '/pipeline',
          navigationState: { tab: 'vip_class' },
        });
      }

      // Outside sales
      for (const s of (outsideSalesRes.data || [])) {
        const dateStr = s.date_closed ? format(parseLocalDate(s.date_closed), 'MMM d') : '';
        found.push({
          id: s.id,
          name: s.member_name,
          context: `${s.membership_type} · ${dateStr}`,
          badge: 'Outside Sale',
          badgeVariant: 'outline',
          category: 'sales',
          navigateTo: '/pipeline',
          navigationState: { tab: 'purchased' },
        });
      }

      setResults(found);
    } catch (err) {
      console.error('Global search error:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => runSearch(query), 300);
    } else {
      setResults([]);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const handleResultClick = (result: SearchResult) => {
    onClose();
    navigate(result.navigateTo, { state: result.navigationState });
  };

  // Group results by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, SearchResult[]>>((acc, cat) => {
    const items = results.filter(r => r.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0">
        <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or phone..."
          className="flex-1 border-0 shadow-none focus-visible:ring-0 text-base bg-transparent"
          autoComplete="off"
        />
        {searching && (
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
        )}
        <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {query.length < 2 && (
          <div className="text-center text-sm text-muted-foreground mt-8">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Type a name or phone number to search
          </div>
        )}

        {query.length >= 2 && !searching && results.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No results for "<strong>{query}</strong>" — try a different name or phone number
          </div>
        )}

        {Object.entries(grouped).map(([cat, items]) => {
          const meta = CATEGORY_META[cat as SearchResult['category']];
          const Icon = meta.icon;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {meta.label} ({items.length})
                </span>
              </div>
              <div className="space-y-1">
                {items.map(result => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/60 active:bg-muted transition-colors text-left"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{result.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.context}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {result.badge && (
                        <Badge variant={result.badgeVariant || 'outline'} className="text-[10px]">
                          {result.badge}
                        </Badge>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Floating search trigger button — add to Header */
interface GlobalSearchTriggerProps {
  onOpen: () => void;
}

export function GlobalSearchTrigger({ onOpen }: GlobalSearchTriggerProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onOpen}
      className="text-background hover:bg-background/10 flex-shrink-0"
      aria-label="Search"
    >
      <Search className="w-4 h-4" />
    </Button>
  );
}
