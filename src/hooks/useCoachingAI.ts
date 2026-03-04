import { useState, useCallback } from 'react';
import { CoachingFeature, CoachingContext, buildPromptForFeature } from '@/lib/aiPrompts';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coaching-ai`;

export function useCoachingAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (feature: CoachingFeature, ctx: CoachingContext) => {
    setIsLoading(true);
    setContent('');
    setError(null);

    const prompt = buildPromptForFeature(feature, ctx);

    try {
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

      while (true) {
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
          if (jsonStr === '[DONE]') break;

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
  }, []);

  return { generate, isLoading, content, error, reset };
}
