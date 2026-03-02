import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'flat';
  accentColor?: string;
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, accentColor, className }: MetricCardProps) {
  return (
    <div className={cn('metric-card flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className={cn('h-4 w-4', accentColor || 'text-muted-foreground')} />}
      </div>
      <span className={cn('text-2xl font-bold font-mono', accentColor || 'text-foreground')}>{value}</span>
    </div>
  );
}
