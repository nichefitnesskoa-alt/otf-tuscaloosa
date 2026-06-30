import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ExternalLink, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

export type VipMetricKind = 'classes' | 'attendees' | 'introsBooked' | 'joins';

export interface VipPerson {
  name: string;
  phone?: string | null;
  email?: string | null;
  badge?: string | null;
  bookingId?: string;
}

export interface VipGroup {
  sessionId: string;
  groupName: string;
  sessionDate: string;
  sessionTime?: string;
  people: VipPerson[];
  legacyCount?: number;
}

const KIND_LABEL: Record<VipMetricKind, string> = {
  classes: 'VIP Classes',
  attendees: 'Total Attendees',
  introsBooked: 'Intros Booked from VIP',
  joins: 'Joins from VIP',
};

function formatSessionDate(d: string, t?: string) {
  if (!d) return '';
  try {
    const dt = parseLocalDate(d);
    const dateStr = format(dt, 'EEE M/d');
    return t ? `${dateStr} · ${t.slice(0, 5)}` : dateStr;
  } catch { return d; }
}

interface Props {
  open: boolean;
  kind: VipMetricKind | null;
  groups: VipGroup[];
  onOpenChange: (open: boolean) => void;
}

export function VipMetricDrilldownDialog({ open, kind, groups, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const total = useMemo(
    () => groups.reduce((sum, g) => sum + (g.people.length || g.legacyCount || 0), 0),
    [groups],
  );

  const allPeople = useMemo(() => {
    const arr: (VipPerson & { groupName: string; sessionDate: string })[] = [];
    groups.forEach(g => g.people.forEach(p => arr.push({ ...p, groupName: g.groupName, sessionDate: g.sessionDate })));
    return arr;
  }, [groups]);

  const handleOpenInPipeline = (p: VipPerson) => {
    const param = p.bookingId ? `focus=${p.bookingId}` : `q=${encodeURIComponent(p.name)}`;
    navigate(`/pipeline?${param}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {kind ? KIND_LABEL[kind] : ''} · {total}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="groups" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="groups">By Group ({groups.length})</TabsTrigger>
            <TabsTrigger value="individuals">By Individual ({allPeople.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="flex-1 overflow-y-auto space-y-2 mt-2 pr-1">
            {groups.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No VIP sessions with data in this metric.</p>
            )}
            {groups.map(g => {
              const isOpen = expandedSession === g.sessionId;
              const count = g.people.length || g.legacyCount || 0;
              return (
                <div key={g.sessionId} className="border rounded-lg">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setExpandedSession(isOpen ? null : g.sessionId)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      <div className="text-left min-w-0">
                        <div className="font-semibold text-sm truncate">{g.groupName}</div>
                        <div className="text-xs text-muted-foreground">{formatSessionDate(g.sessionDate, g.sessionTime)}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{count}</Badge>
                  </button>
                  {isOpen && (
                    <div className="border-t bg-muted/20 divide-y">
                      {g.legacyCount && g.people.length === 0 && (
                        <p className="p-3 text-xs text-muted-foreground italic">
                          Legacy count of {g.legacyCount} — no individual breakdown (this session was logged before per-person outcomes were captured).
                        </p>
                      )}
                      {g.people.map((p, i) => (
                        <div key={i} className="p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[p.phone, p.email].filter(Boolean).join(' · ') || '—'}
                            </div>
                            {p.badge && <Badge variant="outline" className="mt-1 text-[10px]">{p.badge}</Badge>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleOpenInPipeline(p)} className="shrink-0">
                            <ExternalLink className="w-3 h-3 mr-1" /> Pipeline
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="individuals" className="flex-1 overflow-y-auto space-y-1 mt-2 pr-1">
            {allPeople.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No individuals to show.</p>
            )}
            {allPeople.map((p, i) => (
              <div key={i} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.groupName} · {formatSessionDate(p.sessionDate)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[p.phone, p.email].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {p.badge && <Badge variant="outline" className="mt-1 text-[10px]">{p.badge}</Badge>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleOpenInPipeline(p)} className="shrink-0">
                  <ExternalLink className="w-3 h-3 mr-1" /> Pipeline
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
