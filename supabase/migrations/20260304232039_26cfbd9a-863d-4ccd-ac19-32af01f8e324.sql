
-- Fix remaining permissive RLS policies on legacy tables
-- data_imports - keep public read, restrict write to authenticated
DROP POLICY IF EXISTS "Allow all access to data_imports" ON public.data_imports;
CREATE POLICY "Anyone can read data_imports" ON public.data_imports FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert data_imports" ON public.data_imports FOR INSERT TO authenticated WITH CHECK (true);

-- historical_transitions - keep public read, restrict write
DROP POLICY IF EXISTS "Allow all access to historical_transitions" ON public.historical_transitions;
CREATE POLICY "Anyone can read historical_transitions" ON public.historical_transitions FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert historical_transitions" ON public.historical_transitions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update historical_transitions" ON public.historical_transitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- risk_weights - keep public read, restrict write
DROP POLICY IF EXISTS "Allow all access to risk_weights" ON public.risk_weights;
CREATE POLICY "Anyone can read risk_weights" ON public.risk_weights FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert risk_weights" ON public.risk_weights FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update risk_weights" ON public.risk_weights FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- weekly_thresholds - keep public read, restrict write
DROP POLICY IF EXISTS "Allow all access to weekly_thresholds" ON public.weekly_thresholds;
CREATE POLICY "Anyone can read weekly_thresholds" ON public.weekly_thresholds FOR SELECT USING (true);
CREATE POLICY "Authenticated can update weekly_thresholds" ON public.weekly_thresholds FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
