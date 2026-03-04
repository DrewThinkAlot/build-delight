
-- Historical transitions table
CREATE TABLE public.historical_transitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  physician_name TEXT NOT NULL,
  physician_id TEXT,
  opening_date TEXT,
  fiscal_month TEXT,
  guidance_number NUMERIC,
  opening_balance NUMERIC,
  pct_to_guidance NUMERIC,
  hit_guidance BOOLEAN DEFAULT false,
  pre_survey_patients NUMERIC,
  pre_survey_over_55 NUMERIC,
  post_survey_patients NUMERIC,
  wtc_55_plus NUMERIC,
  segmentation TEXT,
  coc_type TEXT,
  state TEXT,
  city TEXT,
  msrp_at_open NUMERIC,
  total_weeks NUMERIC,
  expected_yield NUMERIC,
  actual_yield NUMERIC,
  paid_members_current NUMERIC,
  post_open_growth NUMERIC,
  source_file TEXT,
  data_vintage DATE,
  import_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX idx_hist_trans_dedup ON public.historical_transitions (physician_name, opening_date);

-- Data imports log table
CREATE TABLE public.data_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  sheet_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  import_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Disable RLS for now (public data, no user auth yet)
ALTER TABLE public.historical_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth required for this internal tool)
CREATE POLICY "Allow all access to historical_transitions" ON public.historical_transitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to data_imports" ON public.data_imports FOR ALL USING (true) WITH CHECK (true);
