import { Link } from 'react-router-dom';
import { Plus, Upload, Activity } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, actionLabel, actionTo, secondaryLabel, secondaryTo, icon }: EmptyStateProps) {
  return (
    <div className="metric-card text-center py-12">
      <div className="mx-auto mb-4 text-muted-foreground">
        {icon || <Activity className="h-10 w-10 mx-auto" />}
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">{description}</p>
      <div className="flex items-center justify-center gap-3">
        {actionLabel && actionTo && (
          <Link to={actionTo} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
            <Plus className="h-4 w-4" /> {actionLabel}
          </Link>
        )}
        {secondaryLabel && secondaryTo && (
          <Link to={secondaryTo} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
            <Upload className="h-4 w-4" /> {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
