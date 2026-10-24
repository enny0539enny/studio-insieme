import { supabase } from "@/integrations/supabase/client";
import { generatePlan, selfStudyHours, type PlanCourse, type Weight } from "./planner";

/** Loads everything the generator needs, marks missed sessions, regenerates and stores the plan. */
export async function regeneratePlan(uid: string) {
  const now = new Date();

  // 1. Missed sessions: planned ones whose end has passed. They are rescheduled by regenerating.
  await supabase
    .from("study_sessions_planned")
    .update({ status: "missed" })
    .eq("user_id", uid)
    .eq("status", "planned")
    .lt("ends_at", now.toISOString());

  const [enr, settingsRes, sessionsRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select("courses(id, credits, class_hours, course_topics(id, weight, sort_order), exams(exam_date), class_events(starts_at, ends_at))")
      .eq("user_id", uid)
      .eq("role", "student"),
    supabase.from("planner_settings").select("*").eq("user_id", uid).maybeSingle(),
    supabase
      .from("study_sessions_planned")
      .select("course_id, starts_at, ends_at, status, actual_minutes, is_manual, topic_ids")
      .eq("user_id", uid)
      .in("status", ["completed", "planned"]),
  ]);

  let settings = settingsRes.data;
  if (!settings) {
    const ins = await supabase.from("planner_settings").insert({ user_id: uid }).select("*").single();
    settings = ins.data!;
  }

  const rawCourses = (enr.data ?? []).map((e) => e.courses).filter((c) => c != null);
  const sessions = sessionsRes.data ?? [];

  // 2. After an exam: personal_buffer = actual hours needed ÷ hours originally estimated.
  let buffer = Number(settings.personal_buffer);
  const updated = [...settings.buffer_updated_courses];
  for (const c of rawCourses) {
    const times = c.exams.map((e) => new Date(e.exam_date).getTime());
    const hasUpcoming = times.some((t) => t > now.getTime());
    if (times.length === 0 || hasUpcoming || updated.includes(c.id)) continue;
    const actual = sessions
      .filter((s) => s.course_id === c.id && s.status === "completed")
      .reduce((m, s) => m + (s.actual_minutes ?? 0), 0) / 60;
    const base = selfStudyHours({ credits: c.credits, classHours: c.class_hours ?? 0 });
    if (actual > 0 && base > 0) buffer = Math.min(3, Math.max(0.8, actual / base));
    updated.push(c.id);
  }

  const courses: PlanCourse[] = rawCourses.map((c) => {
    const upcoming = c.exams
      .map((e) => new Date(e.exam_date))
      .filter((d) => d > now)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return {
      id: c.id,
      credits: c.credits,
      classHours: c.class_hours ?? 0,
      pastClassHours:
        c.class_events
          .filter((e) => new Date(e.ends_at) <= now)
          .reduce((m, e) => m + (new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()), 0) / 3600000,
      examAt: upcoming ?? null,
      topics: c.course_topics.map((t) => ({ id: t.id, weight: t.weight as Weight, sortOrder: t.sort_order })),
    };
  });

  const busy = rawCourses.flatMap((c) => [
    ...c.class_events.map((e) => ({ start: new Date(e.starts_at), end: new Date(e.ends_at) })),
    ...c.exams.map((e) => {
      const s = new Date(e.exam_date);
      return { start: s, end: new Date(s.getTime() + 3 * 3600000) };
    }),
  ]);

  const fixed = sessions
    .filter((s) => s.status === "completed" || (s.is_manual && new Date(s.ends_at) > now))
    .map((s) => ({
      courseId: s.course_id,
      start: new Date(s.starts_at),
      end: new Date(s.ends_at),
      minutes:
        s.status === "completed"
          ? (s.actual_minutes ?? 0)
          : (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000,
      topicIds: s.topic_ids,
    }));

  const plan = generatePlan({
    courses,
    busy,
    fixed,
    now,
    settings: {
      maxHoursPerDay: Number(settings.max_hours_per_day),
      noStudyAfter: String(settings.no_study_after).slice(0, 5),
      buffer,
      mode: settings.plan_mode === "reduced" ? "reduced" : "full",
      preferredSlots: settings.preferred_hours,
    },
  });

  // 3. Replace auto-generated planned sessions; keep completed, missed and manual ones.
  await supabase
    .from("study_sessions_planned")
    .delete()
    .eq("user_id", uid)
    .eq("status", "planned")
    .eq("is_manual", false);

  const rows = plan.sessions.map((s) => ({
    user_id: uid,
    course_id: s.courseId,
    topic_ids: s.topicIds,
    starts_at: s.start.toISOString(),
    ends_at: s.end.toISOString(),
    is_review: s.isReview,
  }));
  for (let i = 0; i < rows.length; i += 400) {
    await supabase.from("study_sessions_planned").insert(rows.slice(i, i + 400));
  }

  await supabase
    .from("planner_settings")
    .update({
      personal_buffer: buffer,
      buffer_updated_courses: updated,
      plan_warnings: plan.missingHours,
      plan_generated_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("user_id", uid);
}

/** Regenerates when there is no plan yet or a session was missed. */
export async function ensurePlan(uid: string) {
  const [{ data: settings }, { count }] = await Promise.all([
    supabase.from("planner_settings").select("plan_generated_at").eq("user_id", uid).maybeSingle(),
    supabase
      .from("study_sessions_planned")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("status", "planned")
      .lt("ends_at", new Date().toISOString()),
  ]);
  if (!settings?.plan_generated_at || (count ?? 0) > 0) await regeneratePlan(uid);
}
