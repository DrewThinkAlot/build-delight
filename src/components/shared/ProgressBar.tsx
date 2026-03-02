import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, max, className, showLabel = true, size = 'md' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const colorClass = pct >= 85 ? 'bg-status-ahead' : pct >= 65 ? 'bg-status-on-track' : pct >= 45 ? 'bg-status-behind' : 'bg-status-critical';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 rounded-full bg-muted overflow-hidden', size === 'sm' ? 'h-1.5' : 'h-2.5')}>
        <div className={cn('h-full rounded-full transition-all duration-500', colorClass)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <span className="text-xs font-mono text-muted-foreground min-w-[3rem] text-right">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
