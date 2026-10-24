import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensurePlan } from "./plan-sync";
import { plannedHours, type Weight } from "./planner";

export const COURSE_BG = ["bg-course-1", "bg-course-2", "bg-course-3", "bg-course-4", "bg-course-5"] as const;
export const COURSE_TEXT = ["text-course-1", "text-course-2", "text-course-3", "text-course-4", "text-course-5"] as const;

export type DashSession = {
  id: string;
  course_id: string;
  topic_ids: string[];
  starts_at: string;
  ends_at: string;
  status: "planned" | "completed" | "missed";
  actual_minutes: number | null;
  is_manual: boolean;
  is_review: boolean;
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function computeStreak(sessions: Pick<DashSession, "status" | "starts_at">[], now = new Date()): number {
  const days = new Set(sessions.filter((s) => s.status === "completed").map((s) => dayKey(new Date(s.starts_at))));
  let d = startOfDay(now);
  if (!days.has(dayKey(d))) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
  return n;
}

export function startOfWeek(d: Date) {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7; // Monday = 0
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - dow);
}

export const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user!.id;
    await ensurePlan(uid);

    const [profile, enr, sessions, settings, attendance, reviews, announcements, matches, peers] = await Promise.all([
      supabase.from("profiles").select("full_name, program_year, universities(name), degree_programs(name)").eq("id", uid).single(),
      supabase
        .from("enrollments")
        .select(
          "courses(id, name, credits, class_hours, course_topics(id, name, weight, sort_order), exams(id, exam_date, source, kind, room), class_events(id, starts_at, ends_at, room), course_professors(full_name, profiles(is_demo)))",
        )
        .eq("user_id", uid)
        .eq("role", "student"),
      supabase.from("study_sessions_planned").select("*").eq("user_id", uid).order("starts_at").range(0, 1999),
      supabase.from("planner_settings").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("attendance").select("class_event_id, attended, source").eq("user_id", uid),
      supabase.from("review_tests").select("*").eq("user_id", uid),
      supabase.from("course_announcements").select("id, course_id, title, body, created_at").order("created_at", { ascending: false }).limit(3),
      supabase.rpc("get_match_candidates"),
      supabase.rpc("topic_peers_this_week"),
    ]);

    const now = new Date();
    const courses = (enr.data ?? [])
      .map((e) => e.courses)
      .filter((c) => c != null)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c, i) => {
        const upcoming = c.exams
          .filter((e) => new Date(e.exam_date) > now)
          .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
        return {
          ...c,
          colorIndex: i % 5,
          topics: [...c.course_topics].sort((a, b) => a.sort_order - b.sort_order) as {
            id: string;
            name: string;
            weight: Weight;
            sort_order: number;
          }[],
          nextExam: upcoming[0] ?? null,
        };
      });

    const allSessions = (sessions.data ?? []) as DashSession[];
    const reviewList = reviews.data ?? [];
    const topicNames: Record<string, string> = {};
    courses.forEach((c) => c.topics.forEach((t) => (topicNames[t.id] = t.name)));

    const courseStats = courses.map((c) => {
      const mine = allSessions.filter((s) => s.course_id === c.id);
      const completedH = mine.filter((s) => s.status === "completed").reduce((m, s) => m + (s.actual_minutes ?? 0), 0) / 60;
      const missedH =
        mine.filter((s) => s.status === "missed").reduce((m, s) => m + (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()), 0) /
        3600000;
      const warnings = (settings.data?.plan_warnings ?? {}) as Record<string, number>;
      const mastery = c.topics.map((t) => {
        const done = reviewList.filter((r) => r.topic_id === t.id && r.completed_at && r.score != null);
        const avg = done.length ? done.reduce((m, r) => m + Number(r.score), 0) / done.length : 0;
        return { ...t, mastery: Math.round(avg * 100) };
      });
      return {
        courseId: c.id,
        plannedH: Math.round(plannedHours({ credits: c.credits, classHours: c.class_hours ?? 0 })),
        completedH: Math.round(completedH * 10) / 10,
        behind: (warnings[c.id] ?? 0) > 0,
        missingH: warnings[c.id] ?? 0,
        mastery,
      };
    });

    const weekStart = startOfWeek(now);
    const weekMinutes = allSessions
      .filter((s) => s.status === "completed" && new Date(s.starts_at) >= weekStart)
      .reduce((m, s) => m + (s.actual_minutes ?? 0), 0);
    const streak = computeStreak(allSessions, now);
    const totalCompleted = allSessions.filter((s) => s.status === "completed").reduce((m, s) => m + (s.actual_minutes ?? 0), 0);
    const aura = Math.round(totalCompleted / 10) + streak * 25;

    const pastClasses = courses.flatMap((c) => c.class_events).filter((e) => new Date(e.ends_at) < now);
    const attendedIds = new Set((attendance.data ?? []).filter((a) => a.attended).map((a) => a.class_event_id));
    const attendedPast = pastClasses.filter((e) => attendedIds.has(e.id)).length;

    return {
      uid,
      profile: profile.data,
      courses,
      courseStats,
      sessions: allSessions,
      topicNames,
      settings: settings.data,
      attendedIds,
      attendanceRate: pastClasses.length && attendedIds.size ? Math.round((attendedPast / pastClasses.length) * 100) : null,
      pendingReviews: reviewList.filter((r) => !r.completed_at && new Date(r.due_at) <= new Date(now.getTime() + 86400000)),
      announcements: announcements.data ?? [],
      matchCount: (matches.data ?? []).length,
      peers: (peers.data ?? []).filter((p) => p.peers > 0),
      weekHours: Math.round((weekMinutes / 60) * 10) / 10,
      streak,
      aura,
    };
  },
});

export type Dashboard = Awaited<ReturnType<NonNullable<typeof dashboardQuery.queryFn>>>;
