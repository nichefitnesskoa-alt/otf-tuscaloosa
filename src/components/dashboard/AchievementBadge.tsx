import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
  progress?: number; // 0-100
  maxProgress?: number;
}

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
};

export function AchievementBadge({
  achievement,
  size = 'md',
  className,
}: AchievementBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className={cn(
              'relative flex items-center justify-center rounded-full border-2 transition-all cursor-pointer',
              achievement.earned
                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/20'
                : 'bg-muted border-muted-foreground/20 grayscale opacity-50',
              sizeClasses[size],
              className
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            initial={achievement.earned ? { scale: 0 } : {}}
            animate={achievement.earned ? { scale: 1 } : {}}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            <span>{achievement.icon}</span>
            {achievement.earned && (
              <motion.div
                className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <span className="text-[10px]">✓</span>
              </motion.div>
            )}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <p className="font-semibold">{achievement.name}</p>
            <p className="text-xs text-muted-foreground">{achievement.description}</p>
            {achievement.earned && achievement.earnedDate && (
              <p className="text-xs text-success mt-1">Earned: {achievement.earnedDate}</p>
            )}
            {!achievement.earned && achievement.progress !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Progress: {achievement.progress}/{achievement.maxProgress || 100}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface AchievementGridProps {
  achievements: Achievement[];
  className?: string;
}

export function AchievementGrid({ achievements, className }: AchievementGridProps) {
  const earned = achievements.filter(a => a.earned);
  const unearned = achievements.filter(a => !a.earned);
  const sorted = [...earned, ...unearned];

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {sorted.map(achievement => (
        <AchievementBadge key={achievement.id} achievement={achievement} size="sm" />
      ))}
    </div>
  );
}
