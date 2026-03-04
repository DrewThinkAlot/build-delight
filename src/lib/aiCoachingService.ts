import { Transition, WeeklyUpdate, CoachingLog } from '@/types/transition';
import {
  CoachingFeature,
  CoachingContext,
  assembleCoachingContext,
  fetchActiveBenchmarks,
  buildPromptForFeature,
} from '@/lib/aiPrompts';

// ── Types ──────────────────────────────────────────────────────────────

export interface GenerationResult {
  content: string;
  prompt_type: CoachingFeature;
  generated_at: string;
  model: string;
}

// ── Column mapping for saving AI outputs back to weekly updates ────────

const AI_COLUMN_MAP: Record<CoachingFeature, string> = {
  weekly_analysis: 'ai_situation_assessment',
  coaching_prep: 'ai_physician_coaching_plan',
  recovery_plan: 'ai_recommended_actions',
  leadership_update: 'ai_leadership_talking_points',
};

// ── High-level service: context → prompt → stream → save ──────────────

/**
 * Assembles full coaching context from in-memory transition data,
 * builds the appropriate prompt, and returns it ready for the edge function.
 *
 * This runs entirely client-side; the actual LLM call happens via
 * the `useCoachingAI` hook which streams from the edge function.
 */
export async function prepareCoachingGeneration(
  transition: Transition,
  updates: WeeklyUpdate[],
  logs: CoachingLog[],
  feature: CoachingFeature
): Promise<{ prompt: string; context: CoachingContext }> {
  // 1. Fetch active benchmarks from DB
  const benchmarks = await fetchActiveBenchmarks();

  // 2. Assemble rich context
  const context = assembleCoachingContext(transition, updates, logs, benchmarks);

  // 3. Build feature-specific prompt
  const prompt = buildPromptForFeature(feature, context);

  return { prompt, context };
}

/**
 * After generation completes, persist the AI output to the latest
 * weekly update so it's available on reload without re-generating.
 */
export function saveGeneratedContent(
  transition: Transition,
  updates: WeeklyUpdate[],
  feature: CoachingFeature,
  content: string,
  updateWeeklyUpdate: (transitionId: string, weekNumber: number, field: string, value: string) => void
): void {
  if (!updates.length) return;

  const latest = updates[0]; // already sorted desc by week_number
  const column = AI_COLUMN_MAP[feature];
  if (!column) return;

  // Update in-memory state via context callback
  updateWeeklyUpdate(transition.id, latest.week_number, column, content);
}

/**
 * Check if we already have cached AI content for this feature
 * in the latest weekly update, avoiding unnecessary re-generation.
 */
export function getCachedContent(
  updates: WeeklyUpdate[],
  feature: CoachingFeature
): string | null {
  if (!updates.length) return null;

  const latest = updates[0];
  const column = AI_COLUMN_MAP[feature];
  if (!column) return null;

  const value = (latest as any)[column];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
