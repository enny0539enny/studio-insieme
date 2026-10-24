<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- All UI strings live in `src/i18n/` (en.ts is the source of truth and active via index.ts; it.ts is a partial Italian translation) (code/comments in English) so more languages can be added by mirroring its shape.
- Institutional data (universities, degree_programs, courses, course_professors, course_topics, course_materials, exams, class_events) carries `source = 'university'` and is read-only for students via RLS; it will later be fed by a university integration.
- Student-added exam dates use `exams.source = 'student'` + `created_by`, visible only to the author.
- Roles live in `user_roles` (never on profiles). Teacher role is granted only by the signup trigger when the email is listed in `course_professors`, or by an admin.
- Signup is restricted at the database level by `handle_new_user` against `university_email_domains`.
- `profiles` has no FK to auth.users so demo people (`is_demo = true`) can exist without accounts; UI must show `DemoBadge` for them.
- Signed-in pages live under `src/routes/_authenticated/` and wrap content in `AppShell` (sidebar desktop, bottom tabs mobile).
- Future AI tutor conversation tables must be owner-only RLS (no teacher/admin/university read).
- Onboarding gate: `_authenticated/route.tsx` redirects students whose `student_profiles.onboarding_completed` is false to `/onboarding`; archetype + match logic is pure in `src/lib/archetype.ts` (tested).
- Matching reads other students only through the security-definer RPC `get_match_candidates()` (first name + matching fields, shared courses only); never widen `student_profiles` RLS for it.
- Guests use anonymous auth; `handle_new_user` links them to the PoliMi demo program (year 1). Guests upgrade via `/account` (`updateUser`), keeping the same user id.
- Study plan: pure generator in `src/lib/planner.ts` (tested); `src/lib/plan-sync.ts` marks missed sessions, updates personal_buffer after exams, and replaces only auto-generated `planned` rows (completed/missed/manual are kept). Runs after onboarding, on Home load when stale/missed, and after drags or settings changes.
- Home data comes from one `dashboardQuery` (`src/lib/dashboard.ts`); mutations invalidate `["dashboard"]`.
- Demo history for every new student/guest comes from `seed_demo_history()` called in `handle_new_user`.
