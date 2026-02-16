import { Shoutout } from '@/hooks/useMeetingAgenda';
import { Textarea } from '@/components/ui/textarea';
import { Trophy } from 'lucide-react';
import { MeetingSection } from './MeetingSection';

interface Props {
  shoutouts: Shoutout[];
  manualShoutouts: string;
  onManualChange: (v: string) => void;
  isAdmin: boolean;
  isPresentMode: boolean;
}

export function ShoutoutsSection({ shoutouts, manualShoutouts, onManualChange, isAdmin, isPresentMode }: Props) {
  const manualLines = manualShoutouts?.split('\n').filter(l => l.trim()) || [];
  const allShoutouts = [
    ...shoutouts.map(s => ({ icon: s.icon, text: `${s.category}: ${s.name} — ${s.metric}` })),
    ...manualLines.map(l => ({ icon: '⭐', text: l })),
  ];

  return (
    <MeetingSection title="Shoutouts" icon={<Trophy className={isPresentMode ? 'w-10 h-10 text-yellow-400' : 'w-5 h-5 text-yellow-500'} />} sectionId="shoutouts" isPresentMode={isPresentMode}>
      <div className={isPresentMode ? 'space-y-6' : 'space-y-3'}>
        {allShoutouts.length === 0 && (
          <p className={isPresentMode ? 'text-xl text-white/60' : 'text-sm text-muted-foreground'}>No shoutouts this week yet.</p>
        )}
        {allShoutouts.map((s, i) => (
          <div key={i} className={isPresentMode
            ? 'flex items-start gap-4 text-2xl text-white'
            : 'flex items-start gap-3 text-sm'
          }>
            <span className={isPresentMode ? 'text-3xl' : 'text-lg'}>{s.icon}</span>
            <span>{s.text}</span>
          </div>
        ))}
      </div>

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
