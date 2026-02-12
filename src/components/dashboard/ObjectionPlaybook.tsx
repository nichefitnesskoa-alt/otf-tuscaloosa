import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';

interface ObjectionPlaybookProps {
  obstacles: string | null;
  fitnessLevel: number | null;
  emotionalDriver: string | null;
}

const OBSTACLE_PLAYBOOKS: Record<string, { tip: string; reframe: string }> = {
  'Cost': {
    tip: 'Focus on value per session vs gym membership. Break it down to daily cost.',
    reframe: '"Think of it as investing $X/day in your health — less than a coffee."',
  },
  'Time': {
    tip: 'Emphasize 1-hour efficient workouts. Ask about their schedule to find pockets.',
    reframe: '"Our classes are designed to maximize results in just 1 hour — no planning needed."',
  },
  'Motivation': {
    tip: 'Highlight community, coach accountability, and the workout variety.',
    reframe: '"That\'s exactly why group fitness works — the energy in the room does the motivating for you."',
  },
  'Intimidation': {
    tip: 'Normalize all fitness levels. Share stories of members who started nervous.',
    reframe: '"Everyone starts somewhere. Our coaches modify every exercise so you go at YOUR pace."',
  },
  'Past injuries': {
    tip: 'Highlight heart-rate based training and coach modifications.',
    reframe: '"Our coaches are trained to work around injuries. You\'ll actually get stronger safely."',
  },
  'Already have a routine': {
    tip: 'Position OTF as a complement, not replacement.',
    reframe: '"A lot of our members use OTF alongside their other workouts for the cardio and accountability."',
  },
};

export function ObjectionPlaybook({ obstacles, fitnessLevel, emotionalDriver }: ObjectionPlaybookProps) {
  if (!obstacles) return null;

  const obstacleList = obstacles.split(' | ').map(o => o.trim()).filter(Boolean);
  const matchedPlaybooks = obstacleList
    .map(o => {
      // Find closest match
      const key = Object.keys(OBSTACLE_PLAYBOOKS).find(k =>
        o.toLowerCase().includes(k.toLowerCase())
      );
      return key ? { obstacle: o, ...OBSTACLE_PLAYBOOKS[key] } : null;
    })
    .filter(Boolean) as Array<{ obstacle: string; tip: string; reframe: string }>;

  if (matchedPlaybooks.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-amber-700">
        <Lightbulb className="w-3.5 h-3.5" />
        Objection Playbook
      </h4>
      {matchedPlaybooks.map((pb, i) => (
        <div key={i} className="text-xs p-2 rounded border border-amber-200 bg-amber-50 space-y-1">
          <div className="font-medium text-amber-800">Obstacle: {pb.obstacle}</div>
          <div className="text-amber-700">{pb.tip}</div>
          <div className="italic text-amber-600">{pb.reframe}</div>
        </div>
      ))}
      {fitnessLevel && fitnessLevel <= 2 && (
        <div className="text-xs p-2 rounded border border-blue-200 bg-blue-50 text-blue-700">
          <span className="font-medium">Low fitness level ({fitnessLevel}/5):</span> Emphasize modifications, heart-rate zones, and "go at your own pace" messaging.
        </div>
      )}
    </div>
  );
}
