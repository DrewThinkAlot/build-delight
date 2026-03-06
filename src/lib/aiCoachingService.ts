import { Transition, CoachingLog } from '@/types/transition';
import { WeeklySnapshot } from '@/types/weeklyIntelligence';
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

// ── High-level service: context → prompt → stream → save ──────────────

export async function prepareCoachingGeneration(
  transition: Transition,
  snapshots: WeeklySnapshot[],
  logs: CoachingLog[],
  feature: CoachingFeature
): Promise<{ prompt: string; context: CoachingContext }> {
  const benchmarks = await fetchActiveBenchmarks();
  const context = assembleCoachingContext(transition, snapshots, logs, benchmarks);
  const prompt = buildPromptForFeature(feature, context);
  return { prompt, context };
}

/**
 * No-op cache check — AI content is no longer stored in weekly data.
 * Always returns null so the hook generates fresh content.
 */
export function getCachedContent(
  _snapshots: WeeklySnapshot[],
  _feature: CoachingFeature
): string | null {
  return null;
}
