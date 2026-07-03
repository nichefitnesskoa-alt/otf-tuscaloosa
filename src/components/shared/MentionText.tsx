import { useMemo } from 'react';
import { useActiveStaff } from '@/hooks/useActiveStaff';
import { useActiveOwners } from '@/hooks/useTheTable';
import { buildMentionCandidates, parseOwnItMentions } from '@/lib/table/mentions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Props {
  text: string | null | undefined;
  className?: string;
  /** Highlight chips for this viewer's name in OTF orange. */
  viewerName?: string | null;
}

/**
 * Renders free text with `@token` chips. Shows the resolved name in a tooltip
 * when the chip is a role tag.
 */
export function MentionText({ text, className, viewerName }: Props) {
  const { staff } = useActiveStaff();
  const { data: owners = [] } = useActiveOwners();

  const candidates = useMemo(
    () => buildMentionCandidates(staff.map(s => s.name), owners),
    [staff, owners],
  );

  const segments = useMemo(() => {
    if (!text) return [] as Array<{ kind: 'text' | 'mention'; value: string; resolved?: string; lane?: string | null }>;
    const matches = parseOwnItMentions(text, candidates);
    const out: Array<{ kind: 'text' | 'mention'; value: string; resolved?: string; lane?: string | null }> = [];
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) out.push({ kind: 'text', value: text.slice(cursor, m.start) });
      out.push({ kind: 'mention', value: m.raw, resolved: m.resolvedName, lane: m.lane });
      cursor = m.end;
    }
    if (cursor < text.length) out.push({ kind: 'text', value: text.slice(cursor) });
    return out;
  }, [text, candidates]);

  if (!text) return <span className={className} />;

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {segments.map((s, i) => {
        if (s.kind === 'text') return <span key={i}>{s.value}</span>;
        const isMe = viewerName && s.resolved?.toLowerCase() === viewerName.toLowerCase();
        const chip = (
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold mx-0.5',
              isMe
                ? 'bg-[#E8540A] text-primary-foreground'
                : 'bg-[#E8540A]/10 text-[#E8540A] border border-[#E8540A]/30',
            )}
          >
            {s.value}
          </span>
        );
        if (s.lane && s.resolved) {
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>{chip}</TooltipTrigger>
              <TooltipContent>{s.resolved}</TooltipContent>
            </Tooltip>
          );
        }
        return <span key={i}>{chip}</span>;
      })}
    </span>
  );
}
