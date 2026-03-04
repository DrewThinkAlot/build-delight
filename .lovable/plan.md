

## Mobile Optimization Review

After reviewing all pages, here are the mobile issues found:

### Pages Already Well-Optimized
- **Dashboard** — Uses responsive grid (`grid-cols-2 md:grid-cols-4`), flex-wrap, and `sm:` breakpoints throughout. Good.
- **DataImport** — Has `overflow-x-auto`, responsive grids, `flex-col-reverse sm:flex-row` for buttons. Good.
- **TransitionsList** — Uses `flex-col sm:flex-row` layout. Good.
- **AppLayout** — Has mobile sidebar with hamburger menu. Good.
- **NewTransition** — Has mobile risk panel below form on small screens, responsive grids. Good.

### Pages with Mobile Issues

#### 1. TransitionDetail (most issues)
- **Tab bar**: `overflow-x-auto` is set but tabs have no scrollbar hint — users may not know they can scroll horizontally to reach "AI Coaching" and "Alerts" tabs.
- **Overview grid** (`grid-cols-1 md:grid-cols-[260px_1fr]`): Works, but the risk score + progress cards stack vertically with no visual separation on mobile.
- **Weekly Updates tab**: The update cards show ratings (PA/Dr/Staff) in a horizontal row that can overflow on narrow screens (`flex items-center gap-4` with 3 StarRating components).
- **Coaching Log tab**: Similar horizontal overflow with mood emoji + duration + star rating + follow-through icons all in one flex row.
- **AI Coaching tab header**: The section header has title on left and multiple buttons (Copy, Copy for Slack, Regenerate, Generate) on the right in a single flex row — will overflow on mobile.
- **Enrollment curve chart**: Fixed 300px height works but X-axis labels can overlap on small screens.

#### 2. WeeklyUpdateForm
- **Star ratings grid**: `grid-cols-3` for PA/Physician/Staff ratings with no responsive breakpoint — squished on mobile.
- **Activities grid**: `grid-cols-3` for Forums Scheduled/Held/Attendance — also no responsive breakpoint.
- **Numbers grid**: `grid-cols-2` works but is tight on very small screens.

#### 3. CoachingLogForm
- **Previous interaction follow-through buttons**: Horizontal layout works but previous interaction card could be tighter on mobile.
- **Follow-up grid**: `grid-cols-2` for follow-up date/notes — works but tight.
- Minor: generally okay, just the grid-cols-2 patterns could benefit from stacking.

#### 4. ModelCalibration
- **Weight changes table**: Has `overflow-x-auto` but the table is wide (5 columns) — scrolling works but the factor names can be long and the table experience is poor on mobile.
- **Calibration history rows**: Flex row with date + label + stats + active badge — overflows on narrow screens, text truncates but can lose important info.
- **Benchmark changes section** (inside collapsible): Likely has similar table issues.
- **Backtest results**: Grid layout needs review.

### Proposed Changes

1. **TransitionDetail**
   - AI Coaching section: wrap action buttons to stack on mobile (`flex-wrap`)
   - Weekly Updates: wrap the ratings row on mobile
   - Coaching Log entries: wrap the metadata row

2. **WeeklyUpdateForm**
   - Change star ratings from `grid-cols-3` to `grid-cols-1 sm:grid-cols-3`
   - Change activities forum grid from `grid-cols-3` to `grid-cols-1 sm:grid-cols-3`

3. **ModelCalibration**
   - Calibration history: stack date/label/stats vertically on mobile
   - Consider hiding less critical table columns on mobile

4. **CoachingLogForm**
   - Minor: follow-up grid from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`

These are targeted CSS class changes (mostly adding `sm:` or `md:` responsive prefixes) across 4 files, no structural changes needed.

