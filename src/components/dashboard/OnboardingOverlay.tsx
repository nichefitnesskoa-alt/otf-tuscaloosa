import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Calendar, MessageSquare, UserPlus, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ONBOARDING_KEY = 'myday_onboarding_complete';

const STEPS = [
  {
    icon: Zap,
    title: 'Day Score',
    description: "This is your Day Score. Complete all actions to hit 100%.",
    color: 'text-primary',
  },
  {
    icon: Calendar,
    title: "Today's Intros",
    description: "Your scheduled visitors. Prep before they arrive, log outcomes after their class.",
    color: 'text-primary',
  },
  {
    icon: MessageSquare,
    title: 'Follow-Ups Due',
    description: "People who need a follow-up text today. Scripts are pre-written for you.",
    color: 'text-warning',
  },
  {
    icon: UserPlus,
    title: 'New Leads',
    description: "Contact these ASAP. Fastest response wins.",
    color: 'text-info',
  },
  {
    icon: Eye,
    title: 'Coming Up',
    description: "What's ahead this week so nothing catches you off guard.",
    color: 'text-muted-foreground',
  },
];

export function OnboardingOverlay() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setVisible(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
        <div className="flex justify-between items-start">
          <div className={cn('p-3 rounded-xl bg-muted inline-flex')}>
            <current.icon className={cn('w-6 h-6', current.color)} />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={dismiss}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div>
          <h3 className="font-bold text-lg">{current.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{current.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i === step ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Skip
            </Button>
            <Button size="sm" onClick={handleNext}>
              {step < STEPS.length - 1 ? 'Next' : 'Got it!'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
