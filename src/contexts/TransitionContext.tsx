import React, { createContext, useContext, useState, useCallback } from 'react';
import { Transition, WeeklyUpdate, CoachingLog, Alert } from '@/types/transition';
import { sampleTransitions, sampleWeeklyUpdates, sampleCoachingLogs, sampleAlerts } from '@/data/sampleData';

interface TransitionContextType {
  transitions: Transition[];
  weeklyUpdates: WeeklyUpdate[];
  coachingLogs: CoachingLog[];
  alerts: Alert[];
  addTransition: (t: Transition) => void;
  updateTransition: (id: string, updates: Partial<Transition>) => void;
  addWeeklyUpdate: (u: WeeklyUpdate) => void;
  addCoachingLog: (l: CoachingLog) => void;
  getTransition: (id: string) => Transition | undefined;
  getUpdatesForTransition: (id: string) => WeeklyUpdate[];
  getLogsForTransition: (id: string) => CoachingLog[];
  getAlertsForTransition: (id: string) => Alert[];
  getLatestUpdate: (id: string) => WeeklyUpdate | undefined;
}

const TransitionContext = createContext<TransitionContextType | null>(null);

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const [transitions, setTransitions] = useState<Transition[]>(sampleTransitions);
  const [weeklyUpdates, setWeeklyUpdates] = useState<WeeklyUpdate[]>(sampleWeeklyUpdates);
  const [coachingLogs, setCoachingLogs] = useState<CoachingLog[]>(sampleCoachingLogs);
  const [alerts] = useState<Alert[]>(sampleAlerts);

  const addTransition = useCallback((t: Transition) => setTransitions(prev => [...prev, t]), []);
  const updateTransition = useCallback((id: string, updates: Partial<Transition>) => {
    setTransitions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);
  const addWeeklyUpdate = useCallback((u: WeeklyUpdate) => {
    setWeeklyUpdates(prev => [...prev, u]);
    setTransitions(prev => prev.map(t => t.id === u.transition_id ? { ...t, current_paid_members: u.current_paid_members } : t));
  }, []);
  const addCoachingLog = useCallback((l: CoachingLog) => setCoachingLogs(prev => [...prev, l]), []);

  const getTransition = useCallback((id: string) => transitions.find(t => t.id === id), [transitions]);
  const getUpdatesForTransition = useCallback((id: string) =>
    weeklyUpdates.filter(u => u.transition_id === id).sort((a, b) => b.week_number - a.week_number), [weeklyUpdates]);
  const getLogsForTransition = useCallback((id: string) =>
    coachingLogs.filter(l => l.transition_id === id).sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()), [coachingLogs]);
  const getAlertsForTransition = useCallback((id: string) => alerts.filter(a => a.transition_id === id), [alerts]);
  const getLatestUpdate = useCallback((id: string) => {
    const updates = weeklyUpdates.filter(u => u.transition_id === id);
    return updates.length ? updates.reduce((a, b) => a.week_number > b.week_number ? a : b) : undefined;
  }, [weeklyUpdates]);

  return (
    <TransitionContext.Provider value={{
      transitions, weeklyUpdates, coachingLogs, alerts,
      addTransition, updateTransition, addWeeklyUpdate, addCoachingLog,
      getTransition, getUpdatesForTransition, getLogsForTransition, getAlertsForTransition, getLatestUpdate,
    }}>
      {children}
    </TransitionContext.Provider>
  );
}

export function useTransitions() {
  const ctx = useContext(TransitionContext);
  if (!ctx) throw new Error('useTransitions must be used within TransitionProvider');
  return ctx;
}
