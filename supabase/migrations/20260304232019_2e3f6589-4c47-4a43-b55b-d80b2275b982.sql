
-- Create transitions table
CREATE TABLE public.transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  physician_name text NOT NULL,
  physician_id text,
  transition_start date NOT NULL,
  opening_date date NOT NULL,
  guidance_number integer NOT NULL,
  be_best_practice integer,
  msrp_at_open integer,
  pre_survey_patients integer,
  pre_survey_over_55 integer,
  post_survey_patients integer,
  wtc_55_plus integer,
  segmentation text,
  coc_type text,
  specialty text,
  state text,
  city text,
  medicaid_pct numeric,
  medicare_dual_pct numeric,
  physician_engagement_level text DEFAULT 'High',
  physician_full_time boolean DEFAULT true,
  physician_has_strong_patient_relationships boolean DEFAULT true,
  physician_comfortable_discussing_fees boolean DEFAULT true,
  partner_group_aligned boolean DEFAULT true,
  assigned_pa text,
  assigned_ptm text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'mea_culpa')),
  risk_score integer DEFAULT 0,
  risk_tier text DEFAULT 'LOW' CHECK (risk_tier IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  total_weeks integer,
  current_paid_members integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create weekly_updates table
CREATE TABLE public.weekly_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transition_id uuid REFERENCES public.transitions(id) ON DELETE CASCADE NOT NULL,
  week_number integer NOT NULL,
  update_date date NOT NULL DEFAULT CURRENT_DATE,
  current_paid_members integer NOT NULL,
  net_change_from_last_week integer,
  survey_prospects_left_pct numeric,
  wtc_remaining integer,
  expected_members_at_this_point integer,
  pacing_status text CHECK (pacing_status IN ('AHEAD', 'ON_TRACK', 'BEHIND', 'CRITICAL')),
  pct_to_guidance numeric,
  projected_opening_number integer,
  members_per_week_needed integer,
  pa_effectiveness_rating integer,
  physician_engagement_rating integer,
  staff_engagement_rating integer,
  physician_making_personal_calls boolean DEFAULT false,
  forums_scheduled integer DEFAULT 0,
  forums_held integer DEFAULT 0,
  forum_attendance integer,
  pa_swap_considered boolean DEFAULT false,
  pa_swap_executed boolean DEFAULT false,
  strategy_change_made boolean DEFAULT false,
  strategy_change_description text,
  notes text,
  primary_obstacle text,
  obstacle_category text,
  what_worked_this_week text,
  what_didnt_work text,
  leadership_update_sent boolean DEFAULT false,
  ptm_sync_completed boolean DEFAULT false,
  physician_coaching_call_completed boolean DEFAULT false,
  ai_situation_assessment text,
  ai_recommended_actions text,
  ai_physician_coaching_plan text,
  ai_leadership_talking_points text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(transition_id, week_number)
);

-- Create coaching_logs table
CREATE TABLE public.coaching_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transition_id uuid REFERENCES public.transitions(id) ON DELETE CASCADE NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  interaction_type text NOT NULL,
  duration_minutes integer,
  topics_covered text,
  commitments_made text,
  your_action_items text,
  physician_mood text,
  confidence_level integer,
  follow_up_needed boolean DEFAULT false,
  follow_up_date date,
  follow_up_notes text,
  followed_through boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create alerts table
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transition_id uuid REFERENCES public.transitions(id) ON DELETE CASCADE NOT NULL,
  severity text NOT NULL CHECK (severity IN ('MODERATE', 'HIGH', 'CRITICAL')),
  rule_name text NOT NULL,
  message text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text DEFAULT 'pem',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for transitions
CREATE POLICY "Users can read own transitions" ON public.transitions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own transitions" ON public.transitions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own transitions" ON public.transitions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own transitions" ON public.transitions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- RLS policies for weekly_updates
CREATE POLICY "Users can read own weekly_updates" ON public.weekly_updates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own weekly_updates" ON public.weekly_updates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own weekly_updates" ON public.weekly_updates FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RLS policies for coaching_logs
CREATE POLICY "Users can read own coaching_logs" ON public.coaching_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own coaching_logs" ON public.coaching_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own coaching_logs" ON public.coaching_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RLS policies for alerts
CREATE POLICY "Users can read own alerts" ON public.alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own alerts" ON public.alerts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RLS policies for profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also update weekly_snapshots and action_completions to reference transitions table
-- Add user_id to weekly_snapshots for RLS
ALTER TABLE public.weekly_snapshots ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS on weekly_snapshots
DROP POLICY IF EXISTS "Allow all access to weekly_snapshots" ON public.weekly_snapshots;
CREATE POLICY "Users can read own weekly_snapshots" ON public.weekly_snapshots FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own weekly_snapshots" ON public.weekly_snapshots FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own weekly_snapshots" ON public.weekly_snapshots FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Add user_id to action_completions for RLS
ALTER TABLE public.action_completions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS on action_completions
DROP POLICY IF EXISTS "Allow all access to action_completions" ON public.action_completions;
CREATE POLICY "Users can read own action_completions" ON public.action_completions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own action_completions" ON public.action_completions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own action_completions" ON public.action_completions FOR DELETE TO authenticated USING (user_id = auth.uid());
