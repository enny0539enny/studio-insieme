import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { DemoBadge } from "@/components/DemoBadge";
import { t } from "@/i18n/it";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user!.id;
    const [profile, roles, enrollments] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, program_year, universities(name), degree_programs(name)")
        .eq("id", uid)
        .single(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("enrollments")
        .select(
          "role, courses(id, name, credits, course_professors(full_name, profile_id, profiles(is_demo)), exams(exam_date, source))",
        )
        .eq("user_id", uid),
    ]);
    if (profile.error) throw profile.error;
    return {
      profile: profile.data,
      isTeacher: (roles.data ?? []).some((r) => r.role === "teacher"),
      courses: (enrollments.data ?? []).map((e) => e.courses).filter(Boolean),
    };
  },
});

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — StudySync" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(homeQuery);
  const { profile } = data;
  const firstName = profile.full_name.split(" ")[0];
  const now = Date.now();

  return (
    <AppShell>
      <p className="text-sm font-medium text-secondary">
        {profile.universities?.name}
        {profile.degree_programs?.name && ` · ${profile.degree_programs.name}`}
        {profile.program_year && ` · ${profile.program_year}° ${t.home.year}`}
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-foreground md:text-4xl">
        {t.home.greeting}, {firstName}
        {data.isTeacher && (
          <span className="ml-3 align-middle rounded-full bg-secondary/15 px-3 py-1 font-sans text-xs font-semibold text-secondary">
            {t.home.teacherBadge}
          </span>
        )}
      </h1>

      <div className="mt-10 flex items-end justify-between">
        <h2 className="font-display text-xl font-semibold">{t.home.yourCourses}</h2>
        <span className="text-xs text-muted-foreground">{t.home.source}</span>
      </div>

      {data.courses.length === 0 ? (
        <p className="mt-4 text-muted-foreground">{t.home.empty}</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {data.courses.map((c) => {
            const next = (c!.exams ?? [])
              .filter((e) => new Date(e.exam_date).getTime() > now)
              .sort((a, b) => a.exam_date.localeCompare(b.exam_date))[0];
            return (
              <article key={c!.id} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold leading-snug text-card-foreground">{c!.name}</h3>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {c!.credits} {t.home.cfu}
                  </span>
                </div>
                {c!.course_professors.map((p) => (
                  <p key={p.full_name} className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
                    {p.full_name}
                    {p.profiles?.is_demo && <DemoBadge />}
                  </p>
                ))}
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
                  {next
                    ? `${t.home.nextExam}: ${new Date(next.exam_date).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`
                    : t.home.noExam}
                  {next?.source === "student" && (
                    <span className="text-xs italic text-secondary">({t.home.addedByYou})</span>
                  )}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
