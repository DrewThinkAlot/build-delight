
CREATE TABLE public.risk_weights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calibration_date timestamptz NOT NULL DEFAULT now(),
  calibration_label text,
  n_transitions integer NOT NULL DEFAULT 0,
  n_hit integer NOT NULL DEFAULT 0,
  n_missed integer NOT NULL DEFAULT 0,
  overall_hit_rate numeric,
  is_active boolean NOT NULL DEFAULT false,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  benchmarks jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to risk_weights" ON public.risk_weights
  FOR ALL USING (true) WITH CHECK (true);
