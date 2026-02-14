import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface NoShowWarningProps {
  memberName: string;
}

export function NoShowWarning({ memberName }: NoShowWarningProps) {
  const { data: noShowCount = 0 } = useQuery({
    queryKey: ['no_show_history', memberName],
    queryFn: async () => {
      const { count } = await supabase
        .from('intros_run')
        .select('id', { count: 'exact', head: true })
        .eq('member_name', memberName)
        .ilike('result', '%no%show%');
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (noShowCount === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 rounded px-2 py-1">
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      <span>Has no-showed {noShowCount} time{noShowCount !== 1 ? 's' : ''}. Consider a personal call.</span>
    </div>
  );
}
