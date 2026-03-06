

## Consolidate Weekly Data Systems

The codebase has two parallel weekly data systems that track overlapping information. Here is the plan to unify them.

### Current State

- **`weekly_snapshots`** table + `useWeeklySnapshots.ts`: Lightweight (paid_members, touches, notes). Powers the Weekly Intelligence engine (metrics, signals, recommendations). Uses date-keyed upsert.
- **`weekly_updates`** table + `useTransitionData.ts`: Heavy form (~30 fields: ratings, forums, obstacles, PA swaps, AI content). Used by `WeeklyUpdateForm.tsx`, `AICoachingTab`, `TransitionDetail` Overview, and Dashboard fallback logic.

Both track `paid_members`, `notes`, `strategy_changed`, and pacing. Dashboard has branching logic that checks snapshots first, then falls back to weekly_updates.

### Plan

#### 1. Extend `weekly_snapshots` table with the unique fields from `weekly_updates`

Add columns to `weekly_snapshots` via migration for the fields that only exist in `weekly_updates` and are actually used:
- `pa_effectiveness_rating`, `physician_engagement_rating`, `staff_engagement_rating` (integer, nullable)
- `physician_making_personal_calls` (boolean, default false)
- `forums_scheduled`, `forums_held` (integer, default 0)
- `forum_attendance` (integer, nullable)
- `pa_swap_considered`, `pa_swap_executed` (boolean, default false)
- `primary_obstacle`, `obstacle_category` (text, nullable)
- `what_worked_this_week`, `what_didnt_work` (text, nullable)
- `survey_prospects_left_pct` (numeric, nullable)
- `wtc_remaining` (integer, nullable)
- `pacing_status` (text, nullable)
- `week_number` (integer, nullable)

Do NOT migrate the AI content fields (`ai_situation_assessment`, etc.) — those belong in the coaching cache, not in weekly data.

#### 2. Merge `WeeklyUpdateForm` into `SnapshotModal` (or replace it)

Replace the separate `/transitions/:id/update` route with an enhanced `SnapshotModal` that has two modes:
- **Quick mode** (default): The current lightweight snapshot fields (paid members, touches, notes)
- **Detailed mode** (expandable): Ratings, forums, obstacles, strategy — the fields from the old WeeklyUpdateForm

This eliminates the confusing dual-entry paths ("Log Update" button vs "Log Weekly Update" link).

#### 3. Update `aiPrompts.ts` to read from snapshots

Refactor `assembleCoachingContext()` to accept `WeeklySnapshot[]` instead of `WeeklyUpdate[]`. Map the new extended snapshot fields to the same context shape. The prompts themselves don't change.

#### 4. Update consumers

- **`Dashboard.tsx`**: Remove `useAllWeeklyUpdates`, `getLatestUpdate()`, and all fallback branches. Use only `intelMap` for pacing/status.
- **`TransitionDetail.tsx`**: Remove `useWeeklyUpdates` hook. Overview tab uses `intel.snapshots` for ratings/team data. "Weekly Updates" tab shows snapshot history instead. Remove the "Log Weekly Update" link; keep only the snapshot modal trigger.
- **`AICoachingTab.tsx`**: Change props from `updates: WeeklyUpdate[]` to `snapshots: WeeklySnapshot[]`. Gate on `snapshots.length === 0` instead.
- **`TransitionsList.tsx`**: Remove unused `useWeeklyUpdates` import (it's already imported but never called).

#### 5. Remove deprecated code

- Delete `useWeeklyUpdates`, `useAddWeeklyUpdate`, `useAllWeeklyUpdates` from `useTransitionData.ts`
- Delete `WeeklyUpdateForm.tsx`
- Remove the `/transitions/:id/update` route from `App.tsx`
- Remove `WeeklyUpdate` type from `types/transition.ts` (keep the interface in a deprecated comment for reference during migration)

#### 6. Update `weekly_snapshots` RLS

The existing RLS policies are already scoped to `auth.uid()`. No changes needed since the new columns are just additional data on existing rows.

### Technical Details

- The `weekly_snapshots` table currently uses `transition_id` as `text`, not `uuid`. This is an existing inconsistency but not blocking — leave it for a separate cleanup.
- The enrollment chart in TransitionDetail currently plots `updates` by `week_number`. After consolidation, plot snapshots by `week_ending_date` instead (convert to week index relative to `transition_start`).
- The `useCoachingAI` hook signature changes from `WeeklyUpdate[]` to `WeeklySnapshot[]`.

### Files Changed

| File | Action |
|------|--------|
| `supabase/migrations/new` | Add columns to `weekly_snapshots` |
| `src/types/weeklyIntelligence.ts` | Extend `WeeklySnapshot` interface |
| `src/components/weekly-intelligence/SnapshotModal.tsx` | Add expandable detailed fields |
| `src/lib/aiPrompts.ts` | Refactor to use `WeeklySnapshot` |
| `src/hooks/useCoachingAI.ts` | Update types |
| `src/components/ai-coaching/AICoachingTab.tsx` | Use snapshots |
| `src/pages/Dashboard.tsx` | Remove weekly_updates fallbacks |
| `src/pages/TransitionDetail.tsx` | Remove weekly_updates, use snapshots |
| `src/pages/TransitionsList.tsx` | Remove unused import |
| `src/hooks/useTransitionData.ts` | Remove weekly_updates hooks |
| `src/pages/WeeklyUpdateForm.tsx` | Delete |
| `src/App.tsx` | Remove update route |
| `src/types/transition.ts` | Remove `WeeklyUpdate` type |

