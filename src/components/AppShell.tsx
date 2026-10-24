import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { PingsBell } from "@/components/PingsBell";
import { Home, BookOpen, Map, Users, MessageCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/i18n";

const items = [
  { to: "/home", label: t.nav.home, icon: Home },
  { to: "/studio", label: t.nav.studio, icon: BookOpen },
  { to: "/mappa", label: t.nav.mappa, icon: Map },
  { to: "/persone", label: t.nav.persone, icon: Users },
  { to: "/chat", label: t.nav.chat, icon: MessageCircle },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user!;
      const [p, sp] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", u.id).maybeSingle(),
        supabase.from("student_profiles").select("archetype, likert_answers").eq("user_id", u.id).maybeSingle(),
      ]);
      const likert = (sp.data?.likert_answers ?? {}) as { social?: number };
      return {
        isGuest: !!u.is_anonymous,
        name: p.data?.full_name ?? "",
        archetype: sp.data?.archetype ?? null,
        social: likert.social,
      };
    },
  });

  const guestBlock = me?.isGuest && (
    <div className="flex flex-col gap-1">
      <span className="w-fit rounded-full bg-secondary/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-secondary">
        {t.guest.badge}
      </span>
      <Link to="/account" className="text-xs font-medium text-primary hover:underline">
        {t.guest.keepData}
      </Link>
    </div>
  );

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-sidebar p-6 md:flex">
        <div className="flex items-center justify-between">
          <Link to="/home" className="font-display text-2xl font-semibold text-primary">
            {t.app.name}
          </Link>
          <PingsBell />
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-primary" }}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mb-4 flex items-center gap-3 px-2">
          <ArchetypeAvatar archetype={me?.archetype} social={me?.social} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me?.name}</p>
            {guestBlock}
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.75} />
          {t.nav.signOut}
        </button>
      </aside>

      {/* Mobile header */}
      <header className="flex items-center justify-between px-5 pt-5 md:hidden">
        <span className="font-display text-xl font-semibold text-primary">{t.app.name}</span>
        <div className="flex items-center gap-3">
          {guestBlock && <div className="text-right [&>div]:items-end">{guestBlock}</div>}
          <PingsBell />
          <ArchetypeAvatar archetype={me?.archetype} social={me?.social} className="h-9 w-9" />
        <button onClick={signOut} aria-label={t.nav.signOut} className="rounded-full p-2 text-muted-foreground">
          <LogOut className="h-5 w-5" strokeWidth={1.75} />
        </button>
        </div>
      </header>

      <main className="px-5 pb-28 pt-6 md:ml-64 md:px-12 md:pb-12 md:pt-12">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PlaceholderPage({ title, text, icon: Icon }: { title: string; text: string; icon: typeof Home }) {
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold text-foreground md:text-4xl">{title}</h1>
      <div className="mt-8 flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-16 text-center shadow-soft">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
          <Icon className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <p className="mt-6 max-w-sm text-muted-foreground">{text}</p>
        <span className="mt-4 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          {t.placeholder.soon}
        </span>
      </div>
    </AppShell>
  );
}
