import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, MapPin, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { isOnMap, liveQuery, spreadAround, venuesQuery, type LiveSession } from "@/lib/live";
import type { Pin } from "@/components/map/LiveMap";

const LiveMap = lazy(() => import("@/components/map/LiveMap"));
const m = t.map;
const STORE = "unimate-map-decisions";

export const Route = createFileRoute("/_authenticated/mappa")({
  head: () => ({
    meta: [
      { title: "Study map — UniMate" },
      { name: "description", content: "See who is studying in Milan and choose who to study with." },
      { property: "og:title", content: "Study map — UniMate" },
      { property: "og:description", content: "See who is studying in Milan and choose who to study with." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

const archName = (k: string | null) => (k ? ((t.archetypes as Record<string, { name: string }>)[k]?.name ?? "") : "");

function MapPage() {
  const { data: venues = [] } = useQuery(venuesQuery);
  const { data: live = [] } = useQuery(liveQuery);
  const [decisions, setDecisions] = useState<Record<string, "accepted" | "declined">>({});

  useEffect(() => {
    try {
      setDecisions(JSON.parse(localStorage.getItem(STORE) ?? "{}"));
    } catch {
      /* ignore */
    }
  }, []);
  function decide(userId: string, d: "accepted" | "declined") {
    const next = { ...decisions, [userId]: d };
    setDecisions(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  }

  const venueById = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v])), [venues]);
  const people = useMemo(() => live.filter((s) => !s.is_mine && isOnMap(s)), [live]);
  const pins: Pin[] = useMemo(() => {
    const byVenue: Record<string, LiveSession[]> = {};
    for (const s of people) if (venueById[s.venue_id!]) (byVenue[s.venue_id!] ??= []).push(s);
    return Object.entries(byVenue).flatMap(([vid, list]) =>
      list.map((s, i) => {
        const [lat, lng] = spreadAround(venueById[vid]!.lat, venueById[vid]!.lng, i, list.length);
        return { lat, lng, session: s };
      }),
    );
  }, [people, venueById]);

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold md:text-4xl">{m.title}</h1>
      <div className="mt-6 h-[50vh] min-h-[360px] overflow-hidden rounded-3xl border border-border bg-muted md:h-[480px]">
        <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
          <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
            <LiveMap pins={pins} selectedId={null} onSelect={() => {}} onMoved={() => {}} flyTo={null} />
          </Suspense>
        </ClientOnly>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {people.map((s) => {
          const d = decisions[s.user_id];
          return (
            <li key={s.session_id} className={cn("rounded-3xl border bg-card p-4 shadow-soft", d === "accepted" ? "border-secondary/50" : "border-border", d === "declined" && "opacity-50")}>
              <div className="flex items-center gap-3">
                <ArchetypeAvatar archetype={s.archetype} social={s.social ?? undefined} className="h-12 w-12" />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold">{s.first_name} {s.is_demo && <DemoBadge />}</p>
                  <p className="text-xs text-muted-foreground">{archName(s.archetype)} · {s.university_name}</p>
                </div>
              </div>
              <p className="mt-3 text-sm font-medium">{s.subject_label}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {venueById[s.venue_id!]?.name}</p>
              <div className="mt-3 flex gap-2">
                {d ? (
                  <p className={cn("text-sm font-medium", d === "accepted" ? "text-secondary" : "text-muted-foreground")}>{t.pings.status[d]}</p>
                ) : (
                  <>
                    <Button size="sm" onClick={() => decide(s.user_id, "accepted")}><Check className="h-4 w-4" /> {t.pings.accept}</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(s.user_id, "declined")}><X className="h-4 w-4" /> {t.pings.decline}</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
