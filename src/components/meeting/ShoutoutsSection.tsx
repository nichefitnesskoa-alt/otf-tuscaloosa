import { ShoutoutCategory, Shoutout } from '@/hooks/useMeetingAgenda';
import { Textarea } from '@/components/ui/textarea';
import { Trophy } from 'lucide-react';
import { MeetingSection } from './MeetingSection';

const MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  shoutoutCategories?: ShoutoutCategory[];
  /** @deprecated backward compat for old snapshots */
  shoutouts?: Shoutout[];
  manualShoutouts: string;
  onManualChange: (v: string) => void;
  isAdmin: boolean;
  isPresentMode: boolean;
}

export function ShoutoutsSection({ shoutoutCategories, shoutouts, manualShoutouts, onManualChange, isAdmin, isPresentMode }: Props) {
  const manualLines = manualShoutouts?.split('\n').filter(l => l.trim()) || [];

  // Use new categories if available, else derive from flat shoutouts
  const cats: ShoutoutCategory[] = shoutoutCategories && shoutoutCategories.length > 0
    ? shoutoutCategories
    : groupLegacyShoutouts(shoutouts || []);

  return (
    <MeetingSection
      title="Shoutouts"
      icon={<Trophy className={isPresentMode ? 'w-10 h-10 text-yellow-400' : 'w-5 h-5 text-yellow-500'} />}
      sectionId="shoutouts"
      isPresentMode={isPresentMode}
    >
      {isPresentMode ? (
        <div className="space-y-8">
          {cats.length === 0 && <p className="text-xl text-white/60">No shoutouts this week yet.</p>}
          {cats.map((cat, ci) => (
            <div key={ci} className="mb-6">
              <p className="text-lg text-white/50 uppercase tracking-wider mb-3">
                {cat.icon} {cat.category}
              </p>
              {cat.entries.map((e, i) => (
                <div key={i} className="flex items-center gap-4 text-2xl text-white mb-2">
                  <span className="text-3xl w-10 text-center">{MEDALS[i] || `#${i + 1}`}</span>
                  <span className="font-bold">{e.name}</span>
                  <span className="text-white/60">— {e.metric}</span>
                </div>
              ))}
            </div>
          ))}
          {manualLines.length > 0 && (
            <div className="mt-4">
              <p className="text-lg text-white/50 uppercase tracking-wider mb-3">⭐ Additional</p>
              {manualLines.map((line, i) => (
                <div key={i} className="flex items-center gap-4 text-2xl text-white mb-2">
                  <span className="text-3xl w-10 text-center">⭐</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {cats.length === 0 && <p className="text-sm text-muted-foreground">No shoutouts this week yet.</p>}
          {cats.map((cat, ci) => (
            <div key={ci}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                {cat.icon} {cat.category}
              </p>
              {cat.entries.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm mb-0.5">
                  <span className="w-6 text-center">{MEDALS[i] || `#${i + 1}`}</span>
                  <span className="font-medium">{e.name}</span>
                  <span className="text-muted-foreground">— {e.metric}</span>
                </div>
              ))}
            </div>
          ))}
          {manualLines.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">⭐ Additional</p>
              {manualLines.map((line, i) => (
                <div key={i} className="flex items-center gap-2 text-sm mb-0.5">
                  <span className="w-6 text-center">⭐</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin && !isPresentMode && (
        <div className="mt-4 pt-4 border-t">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Manual Shoutouts (one per line)</label>
          <Textarea
            value={manualShoutouts}
            onChange={e => onManualChange(e.target.value)}
            placeholder="e.g. Coach Lauren ran an amazing class Friday!"
            rows={3}
          />
        </div>
      )}
    </MeetingSection>
  );
}

/** Convert flat legacy shoutouts into grouped categories */
function groupLegacyShoutouts(shoutouts: Shoutout[]): ShoutoutCategory[] {
  const map = new Map<string, ShoutoutCategory>();
  shoutouts.forEach(s => {
    if (!map.has(s.category)) {
      map.set(s.category, { category: s.category, icon: s.icon, entries: [] });
    }
    map.get(s.category)!.entries.push({ name: s.name, metric: s.metric });
  });
  return Array.from(map.values());
}
