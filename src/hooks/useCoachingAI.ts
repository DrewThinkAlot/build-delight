import { useState, useCallback } from 'react';
import { Transition, WeeklyUpdate, CoachingLog } from '@/types/transition';
import { CoachingFeature } from '@/lib/aiPrompts';
import {
  GenerationResult,
  prepareCoachingGeneration,
  getCachedContent,
} from '@/lib/aiCoachingService';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coaching-ai`;

export function useCoachingAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);

  /**
   * Full pipeline: assemble context → build prompt → stream from edge function.
   * Checks cache first to avoid unnecessary API calls.
   */
  const generateForTransition = useCallback(async (
    transition: Transition,
    updates: WeeklyUpdate[],
    logs: CoachingLog[],
    feature: CoachingFeature,
    skipCache = false
  ) => {
    // Check cache first
    if (!skipCache) {
      const cached = getCachedContent(updates, feature);
      if (cached) {
        setContent(cached);
        setResult({
          content: cached,
          prompt_type: feature,
          generated_at: 'cached',
          model: 'cached',
        });
        return;
      }
    }

    setIsLoading(true);
    setContent('');
    setError(null);
    setResult(null);

    try {
      // 1. Assemble context & build prompt
      const { prompt } = await prepareCoachingGeneration(
        transition, updates, logs, feature
      );

      // 2. Stream from edge function
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt, feature }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(data.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) throw new Error('No response stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setContent(accumulated);
            }
          } catch { /* ignore partial leftovers */ }
        }
      }

      const genResult: GenerationResult = {
        content: accumulated,
        prompt_type: feature,
        generated_at: new Date().toISOString(),
        model: 'google/gemini-3-flash-preview',
      };
      setResult(genResult);

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setError(null);
    setResult(null);
  }, []);

  return { generateForTransition, isLoading, content, error, result, reset };
}
