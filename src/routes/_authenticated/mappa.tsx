import { createFileRoute, Link, useNavigate, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Crosshair, List, LocateFixed, Map as MapIcon, MapPin, Search, SlidersHorizontal, X, Flag, Ban, Send, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { t, locale } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  ACTIVITIES, EMPTY_FILTERS, GENERAL_SUBJECTS, MAX_SESSION_HOURS, distanceKm, guessGeneral, inBounds, isOnMap,
  liveQuery, matchesFilters, pingErrorKey, pingsQuery, spreadAround, venuesQuery,
  type Bounds, type Filters, type LiveSession, type Venue,
} from "@/lib/live";
import type { Pin } from "@/components/map/LiveMap";

const LiveMap = lazy(() => import("@/components/map/LiveMap"));
const m = t.map;

export const Route = createFileRoute("/_authenticated/mappa")({
  head: () => ({
    meta: [
      { title: "Live study map — UniMate" },
      { name: "description", content: "See who is studying in Milan right now and ask to join their session." },
      { property: "og:title", content: "Live study map — UniMate" },
      { property: "og:description", content: "See who is studying in Milan right now and ask to join their session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
const archName = (k: string | null) => (k ? ((t.archetypes as Record<string, { name: string }>)[k]?.name ?? "") : "");

function useMyContext() {
  return useQuery({
    queryKey: ["map-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const [enr, priv] = await Promise.all([
        supabase.from("enrollments").select("courses(id,name)").eq("user_id", uid).eq("role", "student"),
        supabase.from("privacy_settings").select("map_consent_at, open_to_invitations").eq("user_id", uid).maybeSingle(),
      ]);
      const courses = (enr.data ?? []).map((e) => e.courses).filter((c): c is { id: string; name: string } => !!c);
      return { uid, courses, consent: !!priv.data?.map_consent_at, openDefault: priv.data?.open_to_invitations ?? true };
    },
  });
}

function MapPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMyContext();
  const { data: venues = [] } = useQuery(venuesQuery);
  const { data: live = [] } = useQuery(liveQuery);
  const { data: pings = [] } = useQuery(pingsQuery);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<"map" | "list">("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [area, setArea] = useState<Bounds | null>(null);
  const [moved, setMoved] = useState(false);
  const lastBounds = useRef<Bounds | null>(null);
  const center = useRef({ lat: 45.4642, lng: 9.19 });
  const firstMove = useRef(true);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [suggestMode, setSuggestMode] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reportFor, setReportFor] = useState<LiveSession | null>(null);

  const venueById = useMemo(() => Object.fromEntries(venues.map((v) => [v.id, v])), [venues]);
  const mine = live.find((s) => s.is_mine) ?? null;
  const matching = useMemo(() => live.filter((s) => matchesFilters(s, filters)), [live, filters]);

  const pins: Pin[] = useMemo(() => {
    const byVenue: Record<string, LiveSession[]> = {};
    for (const s of matching) if (isOnMap(s) && venueById[s.venue_id!]) (byVenue[s.venue_id!] ??= []).push(s);
    return Object.entries(byVenue).flatMap(([vid, list]) =>
      list.map((s, i) => {
        const [lat, lng] = spreadAround(venueById[vid]!.lat, venueById[vid]!.lng, i, list.length);
        return { lat, lng, session: s };
      }),
    );
  }, [matching, venueById]);

  const listed = useMemo(
    () => pins.filter((p) => !area || inBounds(p.lat, p.lng, area)).map((p) => p.session),
    [pins, area],
  );

  const subjectLabel = (k: string) =>
    k.startsWith("course:") ? (me?.courses.find((c) => c.id === k.slice(7))?.name ?? "") : (m.general[k.slice(4)] ?? "");
  const countText = m.count(matching.length, filters.subjects.length === 1 ? subjectLabel(filters.subjects[0]!) : undefined);
  const selected = live.find((s) => s.session_id === selectedId) ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["live"] });

  async function toggleActive(on: boolean) {
    if (!me) return;
    if (on) {
      if (!me.consent) setConsentOpen(true);
      else setStartOpen(true);
      return;
    }
    if (mine) {
      await supabase.from("live_sessions").update({ ended_at: new Date().toISOString() }).eq("id", mine.session_id);
      await supabase.from("privacy_settings").update({ map_active: false }).eq("user_id", me.uid);
      if (selectedId === mine.session_id) setSelectedId(null);
      await refresh();
    }
  }

  async function confirmConsent() {
    if (!me) return;
    await supabase.from("privacy_settings").update({ map_consent_at: new Date().toISOString(), map_active_allowed: true }).eq("user_id", me.uid);
    await qc.invalidateQueries({ queryKey: ["map-me"] });
    setConsentOpen(false);
    setStartOpen(true);
  }

  function select(id: string) {
    setSelectedId(id);
    const s = live.find((x) => x.session_id === id);
    const v = s?.venue_id ? venueById[s.venue_id] : null;
    if (v && view === "list") {
      setView("map");
      setFlyTo({ lat: v.lat, lng: v.lng, zoom: 17 });
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold md:text-4xl">{m.title}</h1>
          <p className="mt-1 text-muted-foreground">{m.subtitle}</p>
        </div>

        {/* Live status */}
        <div
          className={cn(
            "flex items-center justify-between gap-4 rounded-3xl border p-4 shadow-soft transition-colors",
            mine ? "border-secondary/40 bg-secondary/10" : "border-border bg-card",
          )}
        >
          <div className="min-w-0">
            <p className={cn("flex items-center gap-2 text-lg font-semibold", mine ? "text-secondary" : "text-muted-foreground")}>
              <span className={cn("h-3 w-3 rounded-full", mine ? "animate-pulse bg-secondary" : "bg-muted-foreground/40")} />
              {mine ? m.active : m.inactive}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {mine
                ? m.activeHint(mine.subject_label, mine.venue_id ? (venueById[mine.venue_id]?.name ?? "") : mine.place_kind === "home" ? "home" : "online", fmtTime(mine.ends_at))
                : m.inactiveHint}
            </p>
          </div>
          <Switch
            checked={!!mine}
            onCheckedChange={toggleActive}
            aria-label={mine ? m.endSession : m.start}
            className="h-8 w-14 data-[state=checked]:bg-secondary [&>span]:h-7 [&>span]:w-7 [&>span]:data-[state=checked]:translate-x-6"
          />
        </div>

        <FilterBar filters={filters} setFilters={setFilters} courses={me?.courses ?? []} live={live} subjectLabel={subjectLabel} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold" aria-live="polite" data-testid="live-count">{countText}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setSuggestMode(true); setView("map"); }}>
              <MapPin className="h-4 w-4" /> {m.suggest}
            </Button>
            <div className="flex rounded-full border border-border bg-card p-0.5">
              {(["map", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  {v === "map" ? <MapIcon className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                  {v === "map" ? m.mapView : m.listView}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-3xl border border-border bg-muted md:h-[640px]">
          <div className={cn("absolute inset-0", view === "list" && "invisible")}>
            <ClientOnly fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
              <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
                <LiveMap
                  pins={pins}
                  selectedId={selectedId}
                  onSelect={select}
                  flyTo={flyTo}
                  onMoved={(b, c) => {
                    lastBounds.current = b;
                    center.current = c;
                    if (firstMove.current) { firstMove.current = false; return; }
                    setMoved(true);
                  }}
                />
              </Suspense>
            </ClientOnly>
          </div>

          {view === "map" && !suggestMode && (moved || area) && (
            <div className="absolute left-1/2 top-3 z-[500] flex -translate-x-1/2 gap-2">
              {moved && (
                <Button size="sm" className="rounded-full shadow-soft" onClick={() => { setArea(lastBounds.current); setMoved(false); }}>
                  <Search className="h-4 w-4" /> {m.searchArea}
                </Button>
              )}
              {area && (
                <Button size="sm" variant="outline" className="rounded-full bg-card shadow-soft" onClick={() => setArea(null)}>
                  {m.clearArea}
                </Button>
              )}
            </div>
          )}

          {suggestMode && (
            <>
              <Crosshair className="pointer-events-none absolute left-1/2 top-1/2 z-[500] h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-primary" strokeWidth={2} />
              <div className="absolute inset-x-3 bottom-3 z-[500] flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-soft sm:flex-row sm:items-center">
                <p className="flex-1 text-sm">{m.suggestHint}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSuggestMode(false)}>{m.cancel}</Button>
                  <Button size="sm" onClick={() => setSuggestOpen(true)}>{m.useSpot}</Button>
                </div>
              </div>
            </>
          )}

          {view === "list" && (
            <div className="absolute inset-0 overflow-y-auto bg-background p-3">
              {listed.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{m.noResults}</p>}
              <ul className="flex flex-col gap-2">
                {listed.map((s) => (
                  <li key={s.session_id}>
                    <button onClick={() => select(s.session_id)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left hover:border-primary/40">
                      <ArchetypeAvatar archetype={s.archetype} social={s.social ?? undefined} className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          {s.is_mine ? m.you : s.first_name} {s.is_demo && <DemoBadge />}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.subject_label} · {m.activities[s.activity]} · {venueById[s.venue_id!]?.name}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{m.until(fmtTime(s.ends_at))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected && view === "map" && (
            <PinCard
              s={selected}
              venue={selected.venue_id ? venueById[selected.venue_id] : undefined}
              pings={pings}
              onClose={() => setSelectedId(null)}
              onReport={() => setReportFor(selected)}
              onOpenChat={(id) => navigate({ to: "/chat/$chatId", params: { chatId: id } })}
            />
          )}
        </div>
      </div>

      <ConsentDialog open={consentOpen} onOpenChange={setConsentOpen} onConfirm={confirmConsent} />
      {me && (
        <StartDialog
          open={startOpen}
          onOpenChange={setStartOpen}
          courses={me.courses}
          venues={venues}
          openDefault={me.openDefault}
          uid={me.uid}
          onStarted={async () => {
            setStartOpen(false);
            await refresh();
          }}
        />
      )}
      <SuggestDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        center={center.current}
        onDone={() => { setSuggestOpen(false); setSuggestMode(false); }}
      />
      <ReportDialog s={reportFor} onClose={() => setReportFor(null)} />
    </AppShell>
  );
}

function FilterBar({ filters, setFilters, courses, live, subjectLabel }: {
  filters: Filters; setFilters: (f: Filters) => void; courses: { id: string; name: string }[]; live: LiveSession[]; subjectLabel: (k: string) => string;
}) {
  const universities = useMemo(() => {
    const map = new Map<string, string>();
    live.forEach((s) => s.university_id && map.set(s.university_id, s.university_name ?? ""));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [live]);
  const toggle = (k: string) =>
    setFilters({ ...filters, subjects: filters.subjects.includes(k) ? filters.subjects.filter((x) => x !== k) : [...filters.subjects, k] });
  const any = filters.subjects.length > 0 || filters.university || filters.activity || filters.openOnly;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-full">
              <SlidersHorizontal className="h-4 w-4" /> {m.subjects}
              {filters.subjects.length > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{filters.subjects.length}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{m.yourCourses}</p>
            {courses.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm hover:bg-muted">
                <Checkbox checked={filters.subjects.includes(`course:${c.id}`)} onCheckedChange={() => toggle(`course:${c.id}`)} />
                {c.name}
              </label>
            ))}
            <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{m.generalSubjects}</p>
            {GENERAL_SUBJECTS.map((g) => (
              <label key={g} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm hover:bg-muted">
                <Checkbox checked={filters.subjects.includes(`gen:${g}`)} onCheckedChange={() => toggle(`gen:${g}`)} />
                {m.general[g]}
              </label>
            ))}
          </PopoverContent>
        </Popover>
        <Select value={filters.university ?? "all"} onValueChange={(v) => setFilters({ ...filters, university: v === "all" ? null : v })}>
          <SelectTrigger className="h-9 w-auto rounded-full text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.allUniversities}</SelectItem>
            {universities.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.activity ?? "all"} onValueChange={(v) => setFilters({ ...filters, activity: v === "all" ? null : v })}>
          <SelectTrigger className="h-9 w-auto rounded-full text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.allActivities}</SelectItem>
            {ACTIVITIES.map((a) => <SelectItem key={a} value={a}>{m.activities[a]}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
          <Switch checked={filters.openOnly} onCheckedChange={(v) => setFilters({ ...filters, openOnly: v })} />
          {m.openOnly}
        </label>
        {any && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>{m.reset}</Button>
        )}
      </div>
      {filters.subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.subjects.map((k) => (
            <button key={k} onClick={() => toggle(k)} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {subjectLabel(k)} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PinCard({ s, venue, pings, onClose, onReport, onOpenChat }: {
  s: LiveSession; venue?: Venue; pings: import("@/lib/live").Ping[]; onClose: () => void; onReport: () => void; onOpenChat: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const last = pings.find((p) => !p.incoming && p.other_id === s.user_id);
  const recentDecline = last?.status === "declined" && Date.now() - new Date(last.created_at).getTime() < 24 * 3600_000;

  async function ping() {
    setBusy(true);
    const { data: id, error } = await supabase.rpc("send_ping", { _session_id: s.session_id });
    setBusy(false);
    if (error) return toast.error(m.errors[pingErrorKey(error)]);
    toast.success(m.pingSent(s.first_name));
    await qc.invalidateQueries({ queryKey: ["pings"] });
    if (s.is_demo && id) {
      // Demo students answer on their own after ~5 seconds.
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 5000 : 1500));
        const { data: st } = await supabase.rpc("simulate_demo_reply", { _ping_id: id });
        if (st === "accepted" || st === "declined") {
          await qc.invalidateQueries({ queryKey: ["pings"] });
          if (st === "accepted") {
            const { data: p } = await supabase.from("pings").select("chat_id").eq("id", id).maybeSingle();
            toast.success(m.pingAccepted(s.first_name), {
              action: p?.chat_id ? { label: m.openChat, onClick: () => onOpenChat(p.chat_id!) } : undefined,
            });
          } else toast(m.pingDeclined(s.first_name));
          break;
        }
        if (st !== "pending") break;
      }
    }
  }

  async function cancel() {
    if (!last) return;
    await supabase.rpc("cancel_ping", { _ping_id: last.id });
    qc.invalidateQueries({ queryKey: ["pings"] });
  }

  async function block() {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("blocks").insert({ blocker_id: u.user!.id, blocked_id: s.user_id });
    toast(m.blocked);
    onClose();
    qc.invalidateQueries({ queryKey: ["live"] });
    qc.invalidateQueries({ queryKey: ["pings"] });
  }

  let action: React.ReactNode;
  if (s.is_mine) action = null;
  else if (last?.status === "accepted" && last.chat_id)
    action = <Button className="w-full" onClick={() => onOpenChat(last.chat_id!)}><MessageCircle className="h-4 w-4" /> {m.openChat}</Button>;
  else if (last?.status === "pending")
    action = (
      <div className="flex gap-2">
        <Button className="flex-1" disabled variant="secondary">{m.pingPending}</Button>
        <Button variant="ghost" onClick={cancel}>{m.cancelPing}</Button>
      </div>
    );
  else if (recentDecline) action = <Button className="w-full" disabled variant="outline">{m.declinedState}</Button>;
  else if (!s.open_to_invitations) action = <Button className="w-full" disabled variant="outline">{m.closedInvites}</Button>;
  else action = <Button className="w-full" disabled={busy} onClick={ping}><Send className="h-4 w-4" /> {m.ping}</Button>;

  return (
    <div
      role="dialog"
      aria-label={s.first_name}
      className="absolute inset-x-0 bottom-0 z-[600] max-h-[75%] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-soft md:inset-y-3 md:left-auto md:right-3 md:max-h-none md:w-80 md:rounded-3xl md:border"
    >
      <button onClick={onClose} aria-label={m.close} className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <ArchetypeAvatar archetype={s.archetype} social={s.social ?? undefined} className="h-14 w-14" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-semibold">{s.is_mine ? m.you : s.first_name} {s.is_demo && <DemoBadge />}</p>
          <p className="text-sm text-muted-foreground">{archName(s.archetype)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {[s.university_name, s.program_name, s.program_year ? m.year(s.program_year) : null].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-4 space-y-1.5 rounded-2xl bg-muted/60 p-3 text-sm">
        <p className="font-semibold">{s.subject_label}</p>
        <p className="text-muted-foreground">{m.activities[s.activity]}</p>
        <p className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {venue?.name}</p>
        <p className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {m.until(fmtTime(s.ends_at))}</p>
      </div>
      {s.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {s.tags.map((tg) => <span key={tg} className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">{tg}</span>)}
        </div>
      )}
      <p className={cn("mt-3 text-xs font-medium", s.open_to_invitations ? "text-secondary" : "text-muted-foreground")}>
        {s.open_to_invitations ? m.openInvites : m.closedInvites}
      </p>
      <div className="mt-4">{action}</div>
      {!s.is_mine && (
        <div className="mt-2 flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={block}><Ban className="h-4 w-4" /> {m.block}</Button>
          <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={onReport}><Flag className="h-4 w-4" /> {m.report}</Button>
        </div>
      )}
    </div>
  );
}

function ConsentDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{m.consentTitle}</DialogTitle></DialogHeader>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {m.consentPoints.map((p) => <li key={p} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />{p}</li>)}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{m.cancel}</Button>
          <Button onClick={onConfirm}>{m.consentConfirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DURATIONS = [0.5, 1, 1.5, 2, 3, 4, 5];

function StartDialog({ open, onOpenChange, courses, venues, openDefault, uid, onStarted }: {
  open: boolean; onOpenChange: (o: boolean) => void; courses: { id: string; name: string }[]; venues: Venue[];
  openDefault: boolean; uid: string; onStarted: () => void;
}) {
  const [subject, setSubject] = useState<string>("");
  const [activity, setActivity] = useState<string>("exam_review");
  const [place, setPlace] = useState<string>("");
  const [hours, setHours] = useState("2");
  const [openInv, setOpenInv] = useState(openDefault);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => (here ? [...venues].sort((a, b) => distanceKm(here, a) - distanceKm(here, b)) : venues),
    [venues, here],
  );

  function locate() {
    // Used only to sort the list in memory; never stored or sent.
    navigator.geolocation?.getCurrentPosition((p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }));
  }

  async function start() {
    if (!subject || !place) return;
    setBusy(true);
    const course = subject.startsWith("course:") ? courses.find((c) => c.id === subject.slice(7)) : null;
    const gen = subject.startsWith("gen:") ? subject.slice(4) : guessGeneral(course?.name ?? "");
    const kind = place === "home" || place === "online" ? place : "venue";
    const h = Math.min(MAX_SESSION_HOURS, Number(hours));
    const { error } = await supabase.from("live_sessions").insert({
      user_id: uid,
      course_id: course?.id ?? null,
      subject_label: course?.name ?? m.general[gen] ?? "",
      general_subject: gen,
      activity,
      place_kind: kind,
      venue_id: kind === "venue" ? place : null,
      ends_at: new Date(Date.now() + h * 3600_000).toISOString(),
      open_to_invitations: openInv,
    });
    if (!error) await supabase.from("privacy_settings").update({ map_active: true, open_to_invitations: openInv }).eq("user_id", uid);
    setBusy(false);
    if (error) return toast.error(m.errors.generic);
    onStarted();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{m.startTitle}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{m.subject}</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger aria-label={m.subject}><SelectValue placeholder={m.subject} /></SelectTrigger>
              <SelectContent>
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{m.yourCourses}</p>
                {courses.map((c) => <SelectItem key={c.id} value={`course:${c.id}`}>{c.name}</SelectItem>)}
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{m.generalSubjects}</p>
                {GENERAL_SUBJECTS.map((g) => <SelectItem key={g} value={`gen:${g}`}>{m.general[g]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{m.activity}</Label>
            <div className="grid grid-cols-2 gap-2">
              {ACTIVITIES.map((a) => (
                <button key={a} type="button" onClick={() => setActivity(a)}
                  className={cn("rounded-xl border px-3 py-2 text-sm", activity === a ? "border-primary bg-primary/10 font-semibold text-primary" : "border-border")}>
                  {m.activities[a]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{m.venue}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={locate}><LocateFixed className="h-4 w-4" /> {m.useLocation}</Button>
            </div>
            <Select value={place} onValueChange={setPlace}>
              <SelectTrigger aria-label={m.venue}><SelectValue placeholder={m.venue} /></SelectTrigger>
              <SelectContent>
                {sorted.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{here ? ` · ${distanceKm(here, v).toFixed(1)} km` : ""}
                  </SelectItem>
                ))}
                <SelectItem value="home">{m.home}</SelectItem>
                <SelectItem value="online">{m.online}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{m.locationNote}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{m.endTime}</Label>
            <Select value={hours} onValueChange={setHours}>
              <SelectTrigger aria-label={m.endTime}><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {m.duration(d)} · {fmtTime(new Date(Date.now() + d * 3600_000).toISOString())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
            {m.openToInvites}
            <Switch checked={openInv} onCheckedChange={setOpenInv} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{m.cancel}</Button>
          <Button disabled={!subject || !place || busy} onClick={start}>{m.start}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestDialog({ open, onOpenChange, center, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; center: { lat: number; lng: number }; onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("library");
  async function send() {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("venues").insert({ name: name.trim().slice(0, 80), type, lat: center.lat, lng: center.lng, suggested_by: u.user!.id, approved: false });
    if (error) return toast.error(m.errors.generic);
    toast.success(m.suggestDone);
    setName("");
    onDone();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{m.suggestTitle}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>{m.suggestName}</Label><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>{m.suggestType}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(m.venueTypes).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button disabled={name.trim().length < 2} onClick={send}>{m.suggestSend}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({ s, onClose }: { s: LiveSession | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  async function send() {
    if (!s) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("reports").insert({ reporter_id: u.user!.id, reported_id: s.user_id, reason: reason.trim().slice(0, 500) });
    if (error) return toast.error(m.errors.generic);
    toast.success(m.reportDone);
    setReason("");
    onClose();
  }
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{m.reportTitle}</DialogTitle></DialogHeader>
        <Label>{m.reportReason}</Label>
        <Textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        <DialogFooter><Button disabled={!reason.trim()} onClick={send}>{m.reportSend}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Link };
