/**
 * Small pill showing the captured objection for a person, used in
 * follow-up lists and drilldowns so SAs can see what to prep for.
 * Uses normalizeObjectionLabel() so legacy stored values render as
 * their closest new label.
 */
import { normalizeObjectionLabel } from '@/lib/intros/objections';
import { cn } from '@/lib/utils';

interface Props {
  objection?: string | null;
  className?: string;
}

export function ObjectionChip({ objection, className }: Props) {
  const label = normalizeObjectionLabel(objection);
  if (!label) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-amber-300 dark:border-amber-800',
        'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300',
        'text-[10px] font-medium px-1.5 py-0.5 italic',
        className,
      )}
      title="Primary objection captured on this intro"
    >
      Objection: {label}
    </span>
  );
}
