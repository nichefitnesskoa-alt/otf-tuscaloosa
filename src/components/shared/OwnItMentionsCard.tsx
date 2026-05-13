import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AtSign, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMyOwnItMentions } from '@/hooks/useMyOwnItMentions';

interface Props {
  /** When true, render as a slim banner (Own It page top). When false, render as a card (My Day / Coach View). */
  variant?: 'banner' | 'card';
}

export function OwnItMentionsCard({ variant = 'card' }: Props) {
  const { items, acknowledge } = useMyOwnItMentions();
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <Card
      className={cn(
        'mb-4 border-2 border-[#E8540A]/60 bg-[#E8540A]/5',
        variant === 'banner' ? 'p-3' : 'p-4',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <AtSign className="w-4 h-4 text-[#E8540A]" />
          <span className="font-semibold text-sm">
            You're tagged in {items.length} Own It {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <Badge className="bg-[#E8540A]">{items.length}</Badge>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          {items.map(m => (
            <div key={m.id} className="border rounded-md p-2 bg-background">
              <div className="text-xs text-muted-foreground mb-1">
                {m.tagger_user_name} tagged you as <span className="font-semibold">{m.raw_token}</span>
                {m.matched_lane && <span> ({m.tagged_user_name})</span>}
              </div>
              <div className="text-sm">{m.excerpt}</div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/the-table')}
                >
                  Go to Own It
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => acknowledge(m.id)}
                >
                  <Check className="w-3 h-3 mr-1" /> Mark as seen
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
