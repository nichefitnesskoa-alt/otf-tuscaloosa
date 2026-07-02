/**
 * SelfSourcedLeadEntry — collapsible card on My Day for an SA to log a lead
 * they personally sourced. Thin wrapper over SelfSourcedLeadForm (canonical
 * form shared with WIG's "+ Add Lead" dialog).
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { SelfSourcedLeadForm } from '@/components/leads/SelfSourcedLeadForm';

export function SelfSourcedLeadEntry() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-2 border-primary bg-primary text-primary-foreground shadow-md">
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between min-h-[44px] text-left"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-foreground" />
            <div>
              <p className="text-sm font-bold text-primary-foreground">Log a lead you sourced</p>
              <p className="text-[11px] text-primary-foreground/80">
                Counts toward your Leads column on the leaderboard
              </p>
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-primary-foreground" /> : <ChevronDown className="w-4 h-4 text-primary-foreground" />}
        </button>

        {open && (
          <div className="mt-3 border-t border-primary-foreground/20 pt-3 -mx-3 px-3 pb-0 bg-card text-foreground rounded-b-lg">
            <SelfSourcedLeadForm onSaved={() => setOpen(false)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
