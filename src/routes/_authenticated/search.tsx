import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, MapPin, Search as SearchIcon, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { meSocialQuery } from "@/lib/social";
import { t } from "@/i18n";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Search — UniMate" },
      { name: "description", content: "Search students, courses, groups, public sessions and study places." },
      { property: "og:title", content: "Search — UniMate" },
      { property: "og:description", content: "Search students, courses, groups, public sessions and study places." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

type Hit = { kind: string; id: string; title: string; subtitle: string | null; archetype: string | null; social: number | null; is_demo: boolean };
const icons = { course: BookOpen, group: Users, session: CalendarDays, venue: MapPin } as Record<string, typeof Users>;

function SearchPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const { data: me } = useQuery(meSocialQuery);
  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["search", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.rpc("global_search", { _q: debounced });
      return (data ?? []) as Hit[];
    },
  });

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold md:text-4xl">{t.search.title}</h1>
      <div className="relative mt-6">
        <SearchIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search.placeholder} className="h-12 rounded-2xl bg-card pl-11" aria-label={t.search.title} />
      </div>
      {debounced.length < 2 ? (
        <p className="mt-6 text-sm text-muted-foreground">{t.search.hint}</p>
      ) : hits.length === 0 && !isFetching ? (
        <p className="mt-6 text-sm text-muted-foreground">{t.search.none}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {hits.map((h) => {
            const Icon = icons[h.kind];
            const inner = (
              <>
                {h.kind === "student" ? (
                  <ArchetypeAvatar archetype={h.archetype} social={h.social ?? undefined} className="h-10 w-10" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/15 text-secondary">{Icon && <Icon className="h-5 w-5" />}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">{h.title} {h.is_demo && <DemoBadge />}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.search.kinds[h.kind]}{h.subtitle ? ` · ${h.subtitle}` : ""}</p>
                </div>
              </>
            );
            const cls = "flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/40";
            return (
              <li key={h.kind + h.id}>
                {h.kind === "group" ? (
                  <Link to="/groups/$groupId" params={{ groupId: h.id }} className={cls}>{inner}</Link>
                ) : h.kind === "course" && me?.courseNames[h.id] ? (
                  <Link to="/course/$courseId" params={{ courseId: h.id }} className={cls}>{inner}</Link>
                ) : h.kind === "venue" ? (
                  <Link to="/mappa" className={cls}>{inner}</Link>
                ) : h.kind === "student" ? (
                  <Link to="/persone" className={cls}>{inner}</Link>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
