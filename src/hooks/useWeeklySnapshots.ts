import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { WeeklySnapshot, WeeklyThresholds, ActionCompletion, TransitionIntelligence } from '@/types/weeklyIntelligence';
import { DEFAULT_THRESHOLDS } from '@/types/weeklyIntelligence';
import { computeWeeklyMetrics } from '@/lib/weeklyMetrics';
import { generateSignals } from '@/lib/weeklySignals';
import { generateRecommendations } from '@/lib/recommendations';
import type { Transition } from '@/types/transition';

// ── Thresholds cache ──────────────────────────────────────────────────

let cachedThresholds: WeeklyThresholds | null = null;

async function fetchThresholds(): Promise<WeeklyThresholds> {
  if (cachedThresholds) return cachedThresholds;
  try {
    const { data } = await supabase
      .from('weekly_thresholds' as any)
      .select('*')
      .limit(1)
      .single();
    if (data) {
      cachedThresholds = {
        behind_pace_thresholds: (data as any).behind_pace_thresholds ?? DEFAULT_THRESHOLDS.behind_pace_thresholds,
        min_touches: (data as any).min_touches ?? DEFAULT_THRESHOLDS.min_touches,
        stalling_wow_threshold: (data as any).stalling_wow_threshold ?? DEFAULT_THRESHOLDS.stalling_wow_threshold,
      };
      return cachedThresholds;
    }
  } catch { /* fallback */ }
  return DEFAULT_THRESHOLDS;
}

// ── Fetch snapshots for a transition ──────────────────────────────────

async function fetchSnapshots(transitionId: string): Promise<WeeklySnapshot[]> {
  const { data } = await supabase
    .from('weekly_snapshots' as any)
    .select('*')
    .eq('transition_id', transitionId)
    .order('week_ending_date', { ascending: true });
  return (data as unknown as WeeklySnapshot[]) ?? [];
}

async function fetchCompletions(transitionId: string): Promise<ActionCompletion[]> {
  const { data } = await supabase
    .from('action_completions' as any)
    .select('*')
    .eq('transition_id', transitionId);
  return (data as unknown as ActionCompletion[]) ?? [];
}

// ── Hook: single transition intelligence ──────────────────────────────

export function useTransitionIntelligence(transition: Transition | undefined) {
  const [intel, setIntel] = useState<TransitionIntelligence | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!transition) return;
    setLoading(true);
    try {
      const [snapshots, thresholds, completions] = await Promise.all([
        fetchSnapshots(transition.id),
        fetchThresholds(),
        fetchCompletions(transition.id),
      ]);

      const metrics = computeWeeklyMetrics(snapshots, transition.opening_date);
      const signals = metrics ? generateSignals(metrics, snapshots, thresholds) : [];
      const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
      const recommendations = generateRecommendations(transition, latestSnapshot, metrics, signals);

      setIntel({
        transitionId: transition.id,
        snapshots,
        metrics,
        signals,
        recommendations,
        completions,
      });
    } catch (err) {
      console.error('Failed to load intelligence:', err);
    } finally {
      setLoading(false);
    }
  }, [transition]);

  useEffect(() => { refresh(); }, [refresh]);

  return { intel, loading, refresh };
}

// ── Hook: all transitions intelligence (for Dashboard) ────────────────

export function useAllTransitionsIntelligence(transitions: Transition[]) {
  const [intelMap, setIntelMap] = useState<Record<string, TransitionIntelligence>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (transitions.length === 0) return;
    setLoading(true);
    try {
      const thresholds = await fetchThresholds();

      // Fetch all snapshots at once
      const ids = transitions.map(t => t.id);
      const { data: allSnapshotsRaw } = await supabase
        .from('weekly_snapshots' as any)
        .select('*')
        .in('transition_id', ids)
        .order('week_ending_date', { ascending: true });
      const allSnapshots = (allSnapshotsRaw as unknown as WeeklySnapshot[]) ?? [];

      // Fetch all completions
      const { data: allCompletionsRaw } = await supabase
        .from('action_completions' as any)
        .select('*')
        .in('transition_id', ids);
      const allCompletions = (allCompletionsRaw as unknown as ActionCompletion[]) ?? [];

      const result: Record<string, TransitionIntelligence> = {};

      for (const t of transitions) {
        const snapshots = allSnapshots.filter(s => s.transition_id === t.id);
        const completions = allCompletions.filter(c => c.transition_id === t.id);
        const metrics = computeWeeklyMetrics(snapshots, t.opening_date);
        const signals = metrics ? generateSignals(metrics, snapshots, thresholds) : [];
        const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
        const recommendations = generateRecommendations(t, latestSnapshot, metrics, signals);

        result[t.id] = { transitionId: t.id, snapshots, metrics, signals, recommendations, completions };
      }

      setIntelMap(result);
    } catch (err) {
      console.error('Failed to load all intelligence:', err);
    } finally {
      setLoading(false);
    }
  }, [transitions]);

  useEffect(() => { refresh(); }, [refresh]);

  return { intelMap, loading, refresh };
}

// ── Upsert snapshot ───────────────────────────────────────────────────

export async function upsertSnapshot(snapshot: Omit<WeeklySnapshot, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('weekly_snapshots' as any)
    .upsert(
      { ...snapshot, updated_at: new Date().toISOString() },
      { onConflict: 'transition_id,week_ending_date' }
    );
  return error ? { success: false, error: error.message } : { success: true };
}

// ── Toggle action completion ──────────────────────────────────────────

export async function toggleActionCompletion(
  transitionId: string,
  weekEndingDate: string,
  actionKey: string,
  completed: boolean,
): Promise<boolean> {
  if (completed) {
    const { error } = await supabase
      .from('action_completions' as any)
      .upsert(
        { transition_id: transitionId, week_ending_date: weekEndingDate, action_key: actionKey },
        { onConflict: 'transition_id,week_ending_date,action_key' }
      );
    return !error;
  } else {
    const { error } = await supabase
      .from('action_completions' as any)
      .delete()
      .eq('transition_id', transitionId)
      .eq('week_ending_date', weekEndingDate)
      .eq('action_key', actionKey);
    return !error;
  }
}
