/**
 * WhatsChangedDialog — Shows a "What's Changed" notice on login
 * when there are new changelog entries the user hasn't seen.
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  changes: string[];
  published_at: string;
}

export function WhatsChangedDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    if (!user?.name) return;
    (async () => {
      // Fetch active changelog entries
      const { data: allEntries } = await supabase
        .from('changelog')
        .select('id, version, title, changes, published_at')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(5);

      if (!allEntries || allEntries.length === 0) return;

      // Check which ones the user has seen
      const { data: seen } = await supabase
        .from('changelog_seen')
        .select('changelog_id')
        .eq('user_name', user.name);

      const seenIds = new Set((seen || []).map((s: any) => s.changelog_id));
      const unseen = (allEntries as any[]).filter(e => !seenIds.has(e.id));

      if (unseen.length > 0) {
        setEntries(unseen.map(e => ({
          ...e,
          changes: Array.isArray(e.changes) ? e.changes : [],
        })));
        setOpen(true);
      }
    })();
  }, [user?.name]);

  const handleDismiss = async () => {
    setOpen(false);
    if (!user?.name || entries.length === 0) return;
    // Mark all as seen
    const inserts = entries.map(e => ({
      user_name: user.name,
      changelog_id: e.id,
    }));
    await supabase.from('changelog_seen').insert(inserts as any);
  };

  if (entries.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            What's New
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {entries.map(entry => (
            <div key={entry.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{entry.version}</Badge>
                <span className="text-sm font-semibold">{entry.title}</span>
              </div>
              <ul className="space-y-1 pl-4">
                {entry.changes.map((change, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleDismiss} className="w-full">Got it!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
