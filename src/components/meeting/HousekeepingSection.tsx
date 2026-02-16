import { MeetingSection } from './MeetingSection';
import { ClipboardList } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  notes: string;
  onChange: (v: string) => void;
  isAdmin: boolean;
  isPresentMode: boolean;
}

export function HousekeepingSection({ notes, onChange, isAdmin, isPresentMode }: Props) {
  const lines = notes?.split('\n').filter(l => l.trim()) || [];

  return (
    <MeetingSection
      title="Quick Reminders"
      icon={<ClipboardList className={isPresentMode ? 'w-10 h-10' : 'w-5 h-5'} />}
      sectionId="housekeeping"
      isPresentMode={isPresentMode}
      hidden={isPresentMode && lines.length === 0}
    >
      {isPresentMode ? (
        <ol className="space-y-4 text-2xl text-white list-decimal list-inside">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      ) : (
        <>
          {lines.length > 0 && (
            <ol className="space-y-1 text-sm list-decimal list-inside mb-3">
              {lines.map((line, i) => <li key={i}>{line}</li>)}
            </ol>
          )}
          {isAdmin && (
            <Textarea
              value={notes}
              onChange={e => onChange(e.target.value)}
              placeholder="One reminder per line (e.g. Deep clean Saturday 7AM)"
              rows={3}
            />
          )}
        </>
      )}
    </MeetingSection>
  );
}
