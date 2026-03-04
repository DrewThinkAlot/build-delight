import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCoachingAI } from '@/hooks/useCoachingAI';
import { CoachingFeature } from '@/lib/aiPrompts';
import { getCachedContent } from '@/lib/aiCoachingService';
import { formatMarkdown } from '@/lib/formatMarkdown';
import type { Transition, WeeklyUpdate, CoachingLog } from '@/types/transition';

const moodEmoji: Record<string, string> = {
  enthusiastic: '🔥', engaged: '😊', neutral: '😐', frustrated: '😤', disengaged: '😞', cold_feet: '🥶',
};

const SECTIONS: {
  key: CoachingFeature;
  title: string;
  desc: string;
  bgClass: string;
}[] = [
  { key: 'weekly_analysis', title: 'Weekly Situation Analysis', desc: 'Assessment, priorities & recommended actions', bgClass: 'bg-blue-500/5 border-blue-500/20' },
  { key: 'coaching_prep', title: 'Physician Coaching Prep', desc: 'Conversation plan for your next physician interaction', bgClass: 'bg-emerald-500/5 border-emerald-500/20' },
  { key: 'recovery_plan', title: 'Recovery Sprint Plan', desc: '2-week recovery playbook when pacing falls behind', bgClass: 'bg-amber-500/5 border-amber-500/20' },
  { key: 'leadership_update', title: 'Leadership Update', desc: 'Concise status update for leadership briefing', bgClass: 'bg-purple-500/5 border-purple-500/20' },
];

function AICoachingSection({ section, transition, updates, logs, latest }: {
  section: typeof SECTIONS[number];
  transition: Transition;
  updates: WeeklyUpdate[];
  logs: CoachingLog[];
  latest: WeeklyUpdate | undefined;
}) {
  const { generateForTransition, isLoading, content, error, result, reset } = useCoachingAI();
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    const cached = getCachedContent(updates, section.key);
    if (cached) {
      generateForTransition(transition, updates, logs, section.key, false);
      setHasGenerated(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async (regenerate = false) => {
    setHasGenerated(true);
    await generateForTransition(transition, updates, logs, section.key, regenerate);
  };

  const handleCopy = (forSlack = false) => {
    let text = content;
    if (forSlack) {
      text = text.replace(/^#{1,3}\s+/gm, '').replace(/\*\*/g, '*');
    }
    navigator.clipboard.writeText(text);
    toast.success(forSlack ? 'Copied for Slack' : 'Copied to clipboard');
  };

  if (section.key === 'recovery_plan') {
    const pacing = latest?.pacing_status;
    if (pacing !== 'BEHIND' && pacing !== 'CRITICAL') {
      return (
        <div className="metric-card opacity-60">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-muted-foreground">{section.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Recovery plan available when pacing falls behind.</p>
        </div>
      );
    }
  }

  const lastLog = logs[0];

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', section.bgClass)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> {section.title}
          </h3>
          <p className="text-xs text-muted-foreground">{section.desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasGenerated && content && !isLoading && (
            <>
              <button onClick={() => handleCopy(false)} className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Copy">
                <Copy className="h-3.5 w-3.5" />
              </button>
              {section.key === 'leadership_update' && (
                <button onClick={() => handleCopy(true)} className="px-2 py-1 rounded text-xs bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                  Copy for Slack
                </button>
              )}
              <button onClick={() => handleGenerate(true)} className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Regenerate">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {!isLoading && (
            <button onClick={() => handleGenerate(hasGenerated)} className="px-3 py-1.5 rounded bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors">
              {hasGenerated && content ? 'Regenerate' : 'Generate'}
            </button>
          )}
        </div>
      </div>

      {section.key === 'coaching_prep' && !content && !isLoading && (
        lastLog ? (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 space-y-0.5">
            <p className="font-medium text-foreground/80">Last coaching: {lastLog.log_date} ({lastLog.interaction_type.replace(/_/g, ' ')})</p>
            <p>Mood: {moodEmoji[lastLog.physician_mood || 'neutral']} {lastLog.physician_mood} • Confidence: {lastLog.confidence_level}/5</p>
            {lastLog.commitments_made && <p>Commitments: {lastLog.commitments_made}</p>}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            No coaching history logged yet.
          </div>
        )
      )}

      {isLoading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm text-muted-foreground">Analyzing transition data...</span>
        </div>
      )}

      {content && (
        <div className="space-y-2">
          <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {content.split(/\n(?=#{1,3}\s|(?:\d+\.\s+\*\*)|(?:\*\*\d+\.))/g).map((block, i) => {
              const headerMatch = block.match(/^(#{1,3})\s+(.+?)(?:\n|$)/);
              if (headerMatch) {
                const rest = block.slice(headerMatch[0].length);
                return (
                  <div key={i} className="mt-3 first:mt-0">
                    <h4 className="text-sm font-bold text-foreground mb-1">{headerMatch[2]}</h4>
                    <div>{formatMarkdown(rest)}</div>
                  </div>
                );
              }
              return <div key={i}>{formatMarkdown(block)}</div>;
            })}
          </div>
          {isLoading && <span className="inline-block w-1.5 h-4 bg-accent animate-pulse rounded-sm" />}
          {result && result.generated_at !== 'cached' && (
            <p className="text-[10px] text-muted-foreground/60 pt-1">
              Generated {new Date(result.generated_at).toLocaleString()} • {result.model}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-status-critical bg-status-critical/10 rounded p-3">
          {error}
        </div>
      )}
    </div>
  );
}

interface AICoachingTabProps {
  transition: Transition;
  updates: WeeklyUpdate[];
  logs: CoachingLog[];
  latest: WeeklyUpdate | undefined;
}

export function AICoachingTab({ transition, updates, logs, latest }: AICoachingTabProps) {
  if (updates.length === 0) {
    return (
      <div className="metric-card text-center py-10">
        <Sparkles className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-semibold text-foreground mb-2">AI Coaching Needs Data</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Log your first weekly update to enable AI coaching.
        </p>
        <Link to={`/transitions/${transition.id}/update`} className="inline-flex mt-4 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/80 transition-colors">
          Log Weekly Update
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map(section => (
        <AICoachingSection
          key={section.key}
          section={section}
          transition={transition}
          updates={updates}
          logs={logs}
          latest={latest}
        />
      ))}
    </div>
  );
}
