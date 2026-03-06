import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Transition, CoachingLog, Alert } from '@/types/transition';

// ── Transitions ────────────────────────────────────────────────

export function useTransitionsList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['transitions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transitions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Transition[];
    },
    enabled: !!user,
  });
}

export function useTransition(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['transition', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transitions')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as Transition;
    },
    enabled: !!user && !!id,
  });
}

export function useAddTransition() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Omit<Transition, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('transitions')
        .insert({ ...t, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Transition;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transitions'] }),
  });
}

export function useUpdateTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transition> }) => {
      const { error } = await supabase
        .from('transitions')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['transitions'] });
      qc.invalidateQueries({ queryKey: ['transition', id] });
    },
  });
}

// ── Coaching Logs ──────────────────────────────────────────────

export function useCoachingLogs(transitionId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['coachingLogs', transitionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coaching_logs')
        .select('*')
        .eq('transition_id', transitionId!)
        .order('log_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CoachingLog[];
    },
    enabled: !!user && !!transitionId,
  });
}

export function useAddCoachingLog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (l: Omit<CoachingLog, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('coaching_logs')
        .insert({ ...l, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CoachingLog;
    },
    onSuccess: (_, l) => {
      qc.invalidateQueries({ queryKey: ['coachingLogs', l.transition_id] });
    },
  });
}

// ── Alerts ─────────────────────────────────────────────────────

export function useAlerts(transitionId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['alerts', transitionId],
    queryFn: async () => {
      let query = supabase
        .from('alerts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (transitionId) query = query.eq('transition_id', transitionId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Alert[];
    },
    enabled: !!user,
  });
}

// ── All coaching logs for dashboard ──────────────────────────

export function useAllCoachingLogs(transitionIds: string[]) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['allCoachingLogs', transitionIds.sort().join(',')],
    queryFn: async () => {
      if (transitionIds.length === 0) return [];
      const { data, error } = await supabase
        .from('coaching_logs')
        .select('*')
        .in('transition_id', transitionIds)
        .order('log_date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CoachingLog[];
    },
    enabled: !!user && transitionIds.length > 0,
  });
}
