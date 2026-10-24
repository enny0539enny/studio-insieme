import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, GraduationCap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DemoBadge } from "@/components/DemoBadge";
import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";
import { COURSE_BG, dashboardQuery } from "@/lib/dashboard";
import { t, locale } from "@/i18n";
import { cn } from "@/lib/utils";

const materialsQuery = (courseId: string) =>
  queryOptions({
    queryKey: ["materials", courseId],
    queryFn: async () => {
      const { data } = await supabase.from("course_materials").select("id, title, version, topic_id").eq("course_id", courseId).order("created_at");
      return data ?? [];
    },
  });

export const Route = createFileRoute("/_authenticated/course/$courseId")({
  head: () => ({ meta: [{ title: "Course — UniMate" }] }),
  loader: ({ context, params }) =>
    Promise.all([context.queryClient.ensureQueryData(dashboardQuery), context.queryClient.ensureQueryData(materialsQuery(params.courseId))]),
  component: CoursePage,
});

const weightClass = { high: "bg-primary/15 text-primary", medium: "bg-secondary/15 text-secondary", low: "bg-muted text-muted-foreground" } as const;

function CoursePage() {
  const { courseId } = Route.useParams();
  const { data } = useSuspenseQuery(dashboardQuery);
  const { data: materials } = useSuspenseQuery(materialsQuery(courseId));
  const c = data.courses.find((x) => x.id === courseId);
  const st = data.courseStats.find((x) => x.courseId === courseId);
  if (!c || !st) return <AppShell><p>{t.home.empty}</p></AppShell>;
  const now = new Date();
  const sessions = data.sessions.filter((s) => s.course_id === courseId && s.status !== "missed");
  const upcoming = sessions.filter((s) => new Date(s.starts_at) >= now).slice(0, 12);
  const past = sessions.filter((s) => new Date(s.starts_at) < now).reverse().slice(0, 8);

  const sessionRow = (s: (typeof sessions)[number]) => (
    <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
      <span className={cn("h-2 w-2 rounded-full", COURSE_BG[c.colorIndex])} />
      <span className="w-40 shrink-0 text-muted-foreground">
        {new Date(s.starts_at).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </span>
      <span className="truncate">{s.topic_ids.map((id) => data.topicNames[id]).filter(Boolean).join(", ")}</span>
      {s.is_review && <span className="text-xs text-primary">{t.dash.review}</span>}
    </li>
  );

  return (
    <AppShell>
      <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t.course.back}
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold">{c.name}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {c.credits} {t.home.cfu}
        {c.course_professors.map((p) => (
          <span key={p.full_name} className="inline-flex items-center gap-1">
            · <GraduationCap className="h-4 w-4" /> {p.full_name} {p.profiles?.is_demo && <DemoBadge />}
          </span>
        ))}
        {c.nextExam && ` · ${t.dash.examLabel}: ${new Date(c.nextExam.exam_date).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}`}
      </p>
      <p className="mt-1 text-sm">{t.dash.hours(st.completedH, st.plannedH)}</p>

      <h2 className="mt-10 font-display text-xl font-semibold">{t.course.topics}</h2>
      <div className="mt-3 space-y-2">
        {st.mastery.map((tp) => (
          <div key={tp.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <span className="flex-1 text-sm font-medium">{tp.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", weightClass[tp.weight])}>{t.weight[tp.weight]}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-secondary" style={{ width: `${tp.mastery}%` }} />
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold">{t.course.materials}</h2>
      {materials.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t.course.noMaterials}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
              <FileText className="h-4 w-4 text-secondary" strokeWidth={1.75} />
              <span className="flex-1">{m.title}</span>
              <span className="text-xs text-muted-foreground">{t.course.version(m.version)}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-display text-xl font-semibold">{t.course.sessions}</h2>
      {sessions.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{t.course.noSessions}</p>}
      {upcoming.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.course.upcoming}</p>
          <ul className="divide-y divide-border">{upcoming.map(sessionRow)}</ul>
        </>
      )}
      {past.length > 0 && (
        <>
          <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.course.past}</p>
          <ul className="divide-y divide-border">{past.map(sessionRow)}</ul>
        </>
      )}
    </AppShell>
  );
}
