import { WeekAhead } from '@/hooks/useMeetingAgenda';
import { MeetingSection } from './MeetingSection';
import { CalendarDays } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  weekAhead: WeekAhead;
  eventsNotes: string;
  onEventsChange: (v: string) => void;
  isAdmin: boolean;
  isPresentMode: boolean;
}

export function WeekAheadSection({ weekAhead, eventsNotes, onEventsChange, isAdmin, isPresentMode }: Props) {
  const w = weekAhead;

  return (
    <MeetingSection title="What's Coming" icon={<CalendarDays className={isPresentMode ? 'w-10 h-10' : 'w-5 h-5'} />} sectionId="week-ahead" isPresentMode={isPresentMode}>
      <div className={isPresentMode ? 'space-y-6 text-xl text-white' : 'space-y-3 text-sm'}>
        <div>
          <p className={isPresentMode ? 'font-bold text-2xl mb-2' : 'font-medium mb-1'}>
            {w.totalIntros} intros booked this week
          </p>
          {Object.keys(w.introsByDay).length > 0 && (
            <div className={isPresentMode ? 'flex gap-6 text-lg text-white/70' : 'flex gap-3 text-xs text-muted-foreground'}>
              {Object.entries(w.introsByDay).map(([day, count]) => (
                <span key={day}>{day}: {count}</span>
              ))}
            </div>
          )}
        </div>

        <p>{w.followUpsDue} follow-ups due this week</p>
        <p>{w.leadsInPipeline} leads in pipeline</p>

        {w.vipEvents.length > 0 && (
          <div>
            <p className={isPresentMode ? 'font-bold' : 'font-medium'}>VIP Events:</p>
            {w.vipEvents.map((e, i) => (
              <p key={i} className={isPresentMode ? 'text-white/80' : 'text-muted-foreground'}>
                {e.name} — {e.date} ({e.count} capacity)
              </p>
            ))}
          </div>
        )}

        {eventsNotes && (
          <div className={isPresentMode ? 'bg-white/10 p-4 rounded-lg' : 'bg-muted p-3 rounded'}>
            <p className={isPresentMode ? 'text-white/90' : ''}>{eventsNotes}</p>
          </div>
        )}
      </div>

      {isAdmin && !isPresentMode && (
        <div className="mt-4 pt-4 border-t">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Events & Promotions</label>
          <Textarea
            value={eventsNotes}
            onChange={e => onEventsChange(e.target.value)}
            placeholder="e.g. Valentine's promo ends Friday"
            rows={2}
          />
        </div>
      )}
    </MeetingSection>
  );
}
