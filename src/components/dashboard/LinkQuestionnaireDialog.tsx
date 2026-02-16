import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Link2, ClipboardCheck, ClipboardList } from 'lucide-react';

interface LinkQuestionnaireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  memberName: string;
  onLinked: () => void;
}

interface QResult {
  id: string;
  client_first_name: string;
  client_last_name: string;
  status: string;
  q1_fitness_goal: string | null;
  booking_id: string | null;
  scheduled_class_date: string;
  created_at: string;
}

export function LinkQuestionnaireDialog({
  open,
  onOpenChange,
  bookingId,
  memberName,
  onLinked,
}: LinkQuestionnaireDialogProps) {
  const [search, setSearch] = useState(memberName.split(' ')[0] || '');
  const [results, setResults] = useState<QResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    const { data } = await supabase
      .from('intro_questionnaires')
      .select('id, client_first_name, client_last_name, status, q1_fitness_goal, booking_id, scheduled_class_date, created_at')
      .or(`client_first_name.ilike.%${search.trim()}%,client_last_name.ilike.%${search.trim()}%`)
      .order('created_at', { ascending: false })
      .limit(20);
    setResults((data || []) as QResult[]);
    setLoading(false);
  };

  const handleLink = async (questionnaireId: string) => {
    setLinking(true);
    const { error } = await supabase
      .from('intro_questionnaires')
      .update({ booking_id: bookingId } as any)
      .eq('id', questionnaireId);

    if (error) {
      toast.error('Failed to link questionnaire');
    } else {
      toast.success('Questionnaire linked!');
      onLinked();
      onOpenChange(false);
    }
    setLinking(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="w-4 h-4" />
            Link Questionnaire
          </DialogTitle>
          <DialogDescription className="text-xs">
            Search for a completed questionnaire to link to {memberName}'s booking.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="text-sm h-9"
          />
          <Button size="sm" onClick={handleSearch} disabled={loading} className="h-9">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2">
          {loading && <p className="text-xs text-muted-foreground">Searching...</p>}
          {!loading && results.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">
              {search ? 'No questionnaires found. Try a different name.' : 'Enter a name to search.'}
            </p>
          )}
          {results.map(q => (
            <div
              key={q.id}
              className="rounded-lg border p-2.5 text-xs space-y-1 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {q.client_first_name} {q.client_last_name}
                </span>
                <Badge
                  variant={q.status === 'completed' || q.status === 'submitted' ? 'default' : 'secondary'}
                  className="text-[10px]"
                >
                  {q.status === 'completed' || q.status === 'submitted' ? (
                    <><ClipboardCheck className="w-3 h-3 mr-0.5" /> Completed</>
                  ) : (
                    <><ClipboardList className="w-3 h-3 mr-0.5" /> {q.status}</>
                  )}
                </Badge>
              </div>
              {q.q1_fitness_goal && (
                <p className="text-muted-foreground truncate">Goal: {q.q1_fitness_goal}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {q.scheduled_class_date}
                  {q.booking_id ? ' · Already linked' : ''}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px]"
                  disabled={linking}
                  onClick={() => handleLink(q.id)}
                >
                  <Link2 className="w-3 h-3 mr-1" />
                  Link
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
