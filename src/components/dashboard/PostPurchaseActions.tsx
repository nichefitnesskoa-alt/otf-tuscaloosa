import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, CalendarPlus, PartyPopper } from 'lucide-react';
import { useScriptTemplates } from '@/hooks/useScriptTemplates';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';
import { useAuth } from '@/context/AuthContext';

interface PostPurchaseActionsProps {
  memberName: string;
  bookingId: string;
}

export function PostPurchaseActions({ memberName, bookingId }: PostPurchaseActionsProps) {
  const { user } = useAuth();
  const { data: templates = [] } = useScriptTemplates();
  const [activeScript, setActiveScript] = useState<'welcome' | 'referral' | null>(null);

  const firstName = memberName.split(' ')[0] || '';
  const lastName = memberName.split(' ').slice(1).join(' ') || '';

  const welcomeTemplate = templates.find(t => t.is_active && t.category === 'post_class_joined' && (t.sequence_order || 99) <= 1);
  const referralTemplate = templates.find(t => t.is_active && t.category === 'referral_ask' && (t.sequence_order || 99) <= 1);

  const mergeContext = {
    'first-name': firstName,
    'last-name': lastName,
    'sa-name': user?.name,
    'location-name': 'Tuscaloosa',
  };

  return (
    <>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <PartyPopper className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-800">New member! Do these now:</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            onClick={() => setActiveScript('welcome')}
            disabled={!welcomeTemplate}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Welcome Text
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            onClick={() => setActiveScript('referral')}
            disabled={!referralTemplate}
          >
            <Users className="w-3 h-3 mr-1" />
            Ask for Referral
          </Button>
        </div>
      </div>

      {activeScript === 'welcome' && welcomeTemplate && (
        <MessageGenerator
          open={true}
          onOpenChange={(o) => { if (!o) setActiveScript(null); }}
          template={welcomeTemplate}
          mergeContext={mergeContext}
          bookingId={bookingId}
        />
      )}
      {activeScript === 'referral' && referralTemplate && (
        <MessageGenerator
          open={true}
          onOpenChange={(o) => { if (!o) setActiveScript(null); }}
          template={referralTemplate}
          mergeContext={mergeContext}
          bookingId={bookingId}
        />
      )}
    </>
  );
}
