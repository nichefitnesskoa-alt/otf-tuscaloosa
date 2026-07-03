import { MeetingSection } from './MeetingSection';
import { Swords } from 'lucide-react';
import { useObjectionPlaybooks } from '@/hooks/useObjectionPlaybooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  topObjection: string;
  drillOverride: string | null;
  onOverrideChange: (v: string) => void;
  isAdmin: boolean;
  isPresentMode: boolean;
}

export function DrillSection({ topObjection, drillOverride, onOverrideChange, isAdmin, isPresentMode }: Props) {
  const { data: playbooks } = useObjectionPlaybooks();
  const activeObjection = drillOverride || topObjection;
  const playbook = playbooks?.find(p => p.objection_name.toLowerCase() === activeObjection.toLowerCase());

  return (
    <MeetingSection title="This Week's Drill" icon={<Swords className={isPresentMode ? 'w-10 h-10' : 'w-5 h-5'} />} sectionId="drill" isPresentMode={isPresentMode}>
      {isAdmin && !isPresentMode && (
        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Override drill objection</label>
          <Select value={drillOverride || '__auto__'} onValueChange={v => onOverrideChange(v === '__auto__' ? '' : v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder={`Auto: ${topObjection}`} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">Auto: {topObjection}</SelectItem>
              {playbooks?.map(p => (
                <SelectItem key={p.id} value={p.objection_name}>{p.objection_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className={isPresentMode ? 'text-primary-foreground' : ''}>
        <p className={isPresentMode ? 'text-2xl font-bold mb-6 text-warning' : 'text-sm font-semibold mb-3'}>
          EIRMA for "{activeObjection}"
        </p>

        {playbook ? (
          <div className={isPresentMode ? 'space-y-5 text-xl' : 'space-y-3 text-sm'}>
            <div><span className="font-bold text-neutral">E — Empathize:</span> <span className={isPresentMode ? 'text-primary-foreground/90' : ''}>{playbook.empathize_line}</span></div>
            <div><span className="font-bold text-brand">I — Isolate:</span> <span className={isPresentMode ? 'text-primary-foreground/90' : ''}>{playbook.isolate_question}</span></div>
            <div><span className="font-bold text-success">R — Redirect:</span> <span className={isPresentMode ? 'text-primary-foreground/90' : ''}>{playbook.redirect_framework}</span></div>
            <div><span className="font-bold text-brand">M — Suggest:</span> <span className={isPresentMode ? 'text-primary-foreground/90' : ''}>{playbook.suggestion_framework}</span></div>
            <div><span className="font-bold text-danger">A — Ask:</span> <span className={isPresentMode ? 'text-primary-foreground/90' : ''}>{playbook.ask_line}</span></div>
          </div>
        ) : (
          <p className={isPresentMode ? 'text-primary-foreground/60 text-lg' : 'text-muted-foreground text-sm'}>
            No playbook found for "{activeObjection}". Add one in Admin → Coaching.
          </p>
        )}

        <div className={cn(
          'mt-6 p-4 rounded-lg',
          isPresentMode ? 'bg-card/10' : 'bg-muted'
        )}>
          <p className={isPresentMode ? 'text-lg font-semibold text-warning mb-2' : 'text-sm font-medium mb-1'}>Drill Format:</p>
          <p className={isPresentMode ? 'text-lg text-primary-foreground/80' : 'text-sm text-muted-foreground'}>
            Pair up. One person is the member, one is the SA. The member gives the "{activeObjection}" objection. The SA runs EIRMA. Switch after 3 minutes. Go.
          </p>
        </div>
      </div>
    </MeetingSection>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
