
-- Weekly snapshots table
CREATE TABLE public.weekly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_id text NOT NULL,
  week_ending_date date NOT NULL,
  paid_members integer NOT NULL DEFAULT 0,
  guidance_number integer NOT NULL,
  touches_mer_last_week integer DEFAULT 0,
  touches_pa_last_week integer,
  doctor_calls_last_week integer,
  weekly_needed_to_hit_guidance integer,
  strategic_activities text,
  notes text,
  strategy_changed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (transition_id, week_ending_date)
);

ALTER TABLE public.weekly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to weekly_snapshots" ON public.weekly_snapshots
FOR ALL USING (true) WITH CHECK (true);

-- Weekly thresholds settings table
CREATE TABLE public.weekly_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  behind_pace_thresholds jsonb NOT NULL DEFAULT '{"0_4": 0.85, "5_8": 0.75, "9_12": 0.65, "13_plus": 0.55}'::jsonb,
  min_touches integer NOT NULL DEFAULT 8,
  stalling_wow_threshold integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.weekly_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to weekly_thresholds" ON public.weekly_thresholds
FOR ALL USING (true) WITH CHECK (true);

-- Seed default thresholds
INSERT INTO public.weekly_thresholds (behind_pace_thresholds, min_touches, stalling_wow_threshold)
VALUES ('{"0_4": 0.85, "5_8": 0.75, "9_12": 0.65, "13_plus": 0.55}'::jsonb, 8, 0);

-- Action completions for recommendation tracking
CREATE TABLE public.action_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transition_id text NOT NULL,
  week_ending_date date NOT NULL,
  action_key text NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE (transition_id, week_ending_date, action_key)
);

ALTER TABLE public.action_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to action_completions" ON public.action_completions
FOR ALL USING (true) WITH CHECK (true);
