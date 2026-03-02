import { Link } from 'react-router-dom';
import { useTransitions } from '@/contexts/TransitionContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Plus } from 'lucide-react';

export default function TransitionsList() {
  const { transitions, getLatestUpdate } = useTransitions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">All Transitions</h1>
        <Link to="/transitions/new" className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
          <Plus className="h-4 w-4" /> New Transition
        </Link>
      </div>

      <div className="space-y-3">
        {transitions.map(t => {
          const latest = getLatestUpdate(t.id);
          const weeksLeft = t.opening_date ? Math.max(0, Math.ceil((new Date(t.opening_date).getTime() - Date.now()) / (7 * 86400000))) : 0;
          return (
            <Link key={t.id} to={`/transitions/${t.id}`} className="metric-card block hover:border-accent/40 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{t.physician_name}</span>
                    <StatusBadge status={t.status === 'completed' ? 'AHEAD' : (latest?.pacing_status || t.risk_tier || 'LOW')} />
                    {t.status === 'completed' && <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Completed</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.specialty} • {t.city}, {t.state} • {t.coc_type}
                    {t.status === 'active' && ` • ${weeksLeft}w left`}
                  </p>
                </div>
                <div className="w-full sm:w-48">
                  <ProgressBar value={t.current_paid_members || 0} max={t.guidance_number} size="sm" />
                  <span className="text-xs text-muted-foreground font-mono">{t.current_paid_members || 0} / {t.guidance_number}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
