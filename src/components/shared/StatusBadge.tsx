import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  AHEAD: 'status-ahead',
  ON_TRACK: 'status-on-track',
  BEHIND: 'status-behind',
  CRITICAL: 'status-critical',
  LOW: 'status-ahead',
  MODERATE: 'status-on-track',
  HIGH: 'status-behind',
};

const statusLabels: Record<string, string> = {
  AHEAD: 'Ahead',
  ON_TRACK: 'On Track',
  BEHIND: 'Behind',
  CRITICAL: 'Critical',
  LOW: 'Low Risk',
  MODERATE: 'Moderate',
  HIGH: 'High Risk',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('status-badge', statusStyles[status] || 'status-on-track', className)}>
      {statusLabels[status] || status}
    </span>
  );
}
