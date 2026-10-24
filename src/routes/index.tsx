import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Layers, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { GuestButton } from "@/components/GuestButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UniMate — Study better, together" },
      { name: "description", content: t.meta.homeDesc },
      { property: "og:title", content: "UniMate — Study better, together" },
      { property: "og:description", content: t.meta.homeDesc },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const icons = [CalendarClock, Layers, Users];

function Landing() {
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <span className="font-display text-2xl font-semibold text-primary">{t.app.name}</span>
        <Button asChild variant="ghost">
          <Link to="/auth">{t.auth.signIn}</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-20 pt-12 md:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-secondary">{t.app.partner}</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-foreground md:text-7xl">
          {t.landing.title}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">{t.app.tagline}</p>
        <div className="mt-10 max-w-md">
          <GuestButton />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">{t.landing.cta}</Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link to="/home">{t.landing.goToApp}</Link>
          </Button>
        </div>
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {t.landing.features.map((f, i) => {
            const Icon = icons[i] ?? Layers;
            return (
              <div key={f.title} className="rounded-3xl border border-border bg-card p-7 shadow-soft">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <h2 className="mt-5 font-display text-xl font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
