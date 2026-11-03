import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { memo, useMemo } from 'react';
import { cn } from '@ui/utils';

interface ContextUsageRingProps {
  percentage: number;
  usedKb: number;
  maxKb: number;
  className?: string;
  /**
   * 是否在圆环旁显示百分比文本。开启“显示上下文占用”时生效。
   */
  showPercentage?: boolean;
}

export const ContextUsageRing = memo(function ContextUsageRing({
  percentage,
  usedKb,
  maxKb,
  className,
  showPercentage = false,
}: ContextUsageRingProps) {
  const ringColor = useMemo(() => {
    if (percentage >= 90) return 'text-error-foreground';
    if (percentage >= 70) return 'text-warning-foreground';
    return 'text-primary-foreground';
  }, [percentage]);

  const size = 16;
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center gap-1',
            className,
          )}
        >
          <svg
            width={size}
            height={size}
            className="transition-all duration-300 ease-out"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-surface-1 dark:text-surface-2"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`${ringColor} transition-all duration-300 ease-out`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>
          {showPercentage && (
            <span
              className={cn(
                'font-normal text-xs tabular-nums',
                percentage >= 90
                  ? 'text-error-foreground'
                  : percentage >= 70
                    ? 'text-warning-foreground'
                    : 'text-muted-foreground',
              )}
            >
              {percentage}%
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {percentage}% - {usedKb}k / {maxKb}k used
      </TooltipContent>
    </Tooltip>
  );
});
