import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export function TheSystemSection() {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 border border-border text-left font-bold text-lg hover:bg-muted transition-colors">
        <span>THE SYSTEM ▼</span>
        <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 p-4 rounded-lg border border-border bg-card text-sm leading-relaxed space-y-5">
        <div>
          <h3 className="font-bold text-base mb-2">THE SYSTEM — WHY WE DO THIS</h3>
        </div>

        <div>
          <h4 className="font-bold mb-1">THE GOAL</h4>
          <p>Every first-timer leaves with a story worth telling about themselves. Not about OTF. About who they discovered they are in that 60 minutes.</p>
          <p className="mt-2">When that happens — they don't need convincing. The decision is already made before the SA sits down.</p>
        </div>

        <div>
          <h4 className="font-bold mb-1">YOUR ROLE</h4>
          <p>You are the most trusted person in the building right now. The SA has a financial stake in the conversation. You don't. That's what makes everything you say land differently.</p>
          <p className="mt-2">Your job is to plant two seeds on the floor that the SA harvests at the close. No selling. No pressure. Just truth delivered at the right moment.</p>
        </div>

        <div>
          <h4 className="font-bold mb-1">THE RAFFLE — WHY IT EXISTS</h4>
          <p>Before every intro class Koa or the SA briefs the room: "First-timer today. When they hit their all-out — make some noise."</p>
          <p className="mt-2">Every member present when the intro hits their all-out gets entered in the raffle.</p>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li>If the intro signs → one member wins $50 off next month (referral credit)</li>
            <li>If the intro doesn't sign → smaller prize still raffled off</li>
          </ul>
          <p className="mt-2">Why: members who are financially invested in the intro's experience create genuine energy — not polite applause. The intro feels a room of people who actually care. That feeling is what closes memberships.</p>
          <p className="mt-2">Your job: announce the all-out. Let the system do the rest.</p>
        </div>

        <div>
          <h4 className="font-bold mb-1">THE FOURTH QUARTER — ALL-OUT CALLOUT</h4>
          <p>This is the moment everything builds toward. Every class has one — either a traditional all-out or the final 30-60 seconds of the last tread block.</p>
          <p className="mt-2">It is non-negotiable. Every intro. Every class. No exceptions.</p>
          <p className="mt-2">This is the moment the intro discovers who they are under pressure. Your callout is what makes that moment witnessed by the entire room. Witnessed moments become stories. Stories become memberships. Memberships become a studio that changes people's lives.</p>
        </div>

        <div>
          <h4 className="font-bold mb-1">THE TWO SEEDS</h4>
          <p>You plant these on the floor. The SA harvests them at the close. Never ask a closing question — your credibility comes from having no stake in the answer.</p>
          <p className="mt-3"><strong>Seed 1</strong> — During the all-out quietly under the noise:</p>
          <p>Option A: "Remember this feeling. This is what you came for."</p>
          <p>Option B: "Remember this. Right here."</p>
          <p className="text-muted-foreground">Use A if you know why they came. Use B if you don't.</p>
          <p className="mt-3"><strong>Seed 2</strong> — After performance summary. No pause.</p>
          <p>"[SA name] — this one's special."</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
