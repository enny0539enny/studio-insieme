import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { TodaySection } from "@/components/home/TodaySection";
import { ExamsSection } from "@/components/home/ExamsSection";
import { CalendarSection } from "@/components/home/CalendarSection";
import { ForYouSection, ProgressSection } from "@/components/home/ExtraSections";
import { dashboardQuery } from "@/lib/dashboard";
import { t } from "@/i18n";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — UniMate" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  pendingComponent: () => (
    <AppShell>
      <p className="text-muted-foreground">{t.dash.loadingPlan}</p>
    </AppShell>
  ),
  component: HomePage,
});

function HomePage() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const p = data.profile;
  const firstName = p?.full_name.split(" ")[0] ?? "";

  return (
    <AppShell>
      <p className="text-sm font-medium text-secondary">
        {p?.universities?.name}
        {p?.degree_programs?.name && ` · ${p.degree_programs.name}`}
        {p?.program_year && ` · ${t.home.year} ${p.program_year}`}
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">
        {t.home.greeting}, {firstName}
      </h1>

      {data.courses.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
          {t.dash.noCourses}
        </p>
      ) : (
        <div className="mt-8 space-y-12">
          <TodaySection data={data} />
          <ExamsSection data={data} />
          <CalendarSection data={data} />
          <ProgressSection data={data} />
          <ForYouSection data={data} />
        </div>
      )}
    </AppShell>
  );
}
