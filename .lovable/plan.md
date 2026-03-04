

## Project Improvement Recommendations

After reviewing the full codebase, here are the most impactful improvements grouped by category:

---

### 1. Persist Transitions to the Database (High Impact)

Currently all transitions, weekly updates, coaching logs, and alerts live in React state via `TransitionContext`, seeded from `sampleData.ts`. This means:
- Data is lost on page refresh
- Weekly snapshots (in the database) reference transition IDs that only exist in memory
- Two parallel data systems exist (context vs. database) creating confusion

**What to do:**
- Create a `transitions` table in the database (mirrors the `Transition` type)
- Create `weekly_updates`, `coaching_logs`, and `alerts` tables
- Replace `TransitionContext` with React Query hooks that read/write from the database
- Seed the sample data via a migration instead of hardcoded arrays
- Remove `sampleData.ts` (keep `ENROLLMENT_CURVE` and `getExpectedPct` in a separate utility)

---

### 2. Add Authentication (High Impact — Security)

Every database table currently has wide-open RLS policies (`true` for all operations). There is no login, no user identity. This means anyone with the project URL can read/write all data.

**What to do:**
- Add email/password authentication with login and signup pages
- Create a `profiles` table linked to `auth.users`
- Replace the blanket `true` RLS policies with `auth.uid()` scoped policies
- Add a protected route wrapper so unauthenticated users are redirected to login

---

### 3. Clean Up Dual Data Systems (Medium Impact)

The app has two overlapping systems for tracking weekly progress:
- **Legacy**: `WeeklyUpdate` type stored in `TransitionContext` (in-memory) with fields like `pa_effectiveness_rating`, `forums_held`, `pacing_status`
- **New**: `WeeklySnapshot` stored in the database with fields like `paid_members`, `touches_mer_last_week`

The Dashboard and TransitionDetail both have fallback logic that checks legacy data when weekly intelligence isn't available, creating complex branching.

**What to do:**
- Merge the useful fields from `WeeklyUpdate` into the `weekly_snapshots` table (ratings, forums, obstacles)
- Consolidate to a single weekly data entry flow
- Remove the legacy fallback paths in Dashboard and TransitionDetail

---

### 4. Extract TransitionDetail into Smaller Components (Medium Impact)

`TransitionDetail.tsx` is 575 lines with the AI Coaching tab component, markdown formatter, and main component all in one file. This hurts readability and makes changes risky.

**What to do:**
- Extract `AICoachingTab` and `AICoachingSection` into `src/components/ai-coaching/`
- Extract `formatMarkdown` into a shared utility
- Extract the Overview tab content (chart, progress, benchmarks) into its own component
- The main file should just handle routing, tab state, and compose sub-components

---

### 5. Loading and Error States (Medium Impact)

Most pages have no loading indicators or error boundaries. The Dashboard fires multiple async calls (risk weights, weekly intelligence) but shows nothing while loading. If the database is unreachable, the app silently fails.

**What to do:**
- Add skeleton loading states to Dashboard and TransitionDetail
- Add an error boundary component at the route level
- Show toast or inline error messages when database calls fail instead of `catch { /* silent */ }`

---

### 6. Empty State UX (Low-Medium Impact)

When there are no transitions, the Dashboard shows nothing. The TransitionsList shows an empty list. New users have no guidance.

**What to do:**
- Add empty state cards with a CTA to create a first transition or import data
- Add onboarding hints (e.g., "Start by creating a transition or importing your tracker")

---

### 7. Minor Code Quality Fixes

- **`as any` casts in `useWeeklySnapshots.ts`**: The database queries cast tables with `as any` to work around missing types. After tables are created, regenerate the Supabase types so these casts aren't needed.
- **`validateDOMNesting` warning**: The Dashboard has `<Link>` wrapping `<button>` elements (the "Log Update" / "Coach Prep" buttons inside the transition card link). Fix by using `onClick` navigation instead of nesting interactive elements.
- **Unused imports**: `NavLink.tsx` exists but isn't used anywhere.
- **`weeksRemaining`, `totalWeeks`, `pctElapsed`** in `sampleData.ts` are utility functions that should live in `src/lib/` if still needed.

---

### Recommended Priority Order

1. **Persist transitions to database** — foundational; everything else builds on real data
2. **Add authentication** — required for any real usage
3. **Consolidate dual data systems** — reduces complexity and bugs
4. **Component extraction** — improves maintainability
5. **Loading/error states** — improves reliability
6. **Empty states** — improves first-run experience
7. **Code quality** — cleanup pass

