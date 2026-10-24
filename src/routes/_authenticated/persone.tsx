import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MatchesStrip } from "@/components/people/MatchesStrip";
import { SwipeDeck, scoreDeck, type MatchResult } from "@/components/people/SwipeDeck";
import { MatchCelebration } from "@/components/people/MatchCelebration";
import { ProposeSessionDialog, selectClass } from "@/components/people/ProposeSessionDialog";
import { GroupsTab } from "@/components/people/GroupsTab";
import { deckQuery, meSocialQuery } from "@/lib/social";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const pp = t.people;
const o = t.onboarding;

type Search = { tab?: "discover" | "groups"; create?: boolean; course?: string; topic?: string };

export const Route = createFileRoute("/_authenticated/persone")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s.tab === "groups" ? "groups" : undefined,
    create: s.create === true || s.create === "1" || s.create === 1 ? true : undefined,
    course: typeof s.course === "string" ? s.course : undefined,
    topic: typeof s.topic === "string" ? s.topic : undefined,
  }),
  head: () => ({
    meta: [
      { title: "People — UniMate" },
      { name: "description", content: "Swipe to find study partners, join study groups and plan sessions together." },
      { property: "og:title", content: "People — UniMate" },
      { property: "og:description", content: "Swipe to find study partners, join study groups and plan sessions together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeoplePage,
});

type Filters = { course: string; uni: string; slot: string; looking: string };
const noFilters: Filters = { course: "", uni: "", slot: "", looking: "" };

function PeoplePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/persone" });
  const tab = search.tab ?? "discover";
  const { data: me } = useQuery(meSocialQuery);
  const { data: deck } = useQuery({ ...deckQuery, staleTime: Infinity });
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [draft, setDraft] = useState<Filters>(noFilters);
  const [sheet, setSheet] = useState(false);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [propose, setPropose] = useState<MatchResult | null>(null);

  const scored = useMemo(
    () => (me && deck ? scoreDeck(deck, me.profile, me.upcomingExamCourseIds, me.courseNames) : null),
    [me, deck],
  );
  const cards = useMemo(
    () =>
      (scored ?? []).filter(
        (c) =>
          (!filters.course || c.shared_course_ids.includes(filters.course)) &&
          (!filters.uni || c.university_id === filters.uni) &&
          (!filters.slot || c.time_slots.includes(filters.slot)) &&
          (!filters.looking || c.looking_for === filters.looking),
      ),
    [scored, filters],
  );
  const unis = useMemo(() => {
    const m = new Map<string, string>();
    (deck ?? []).forEach((d) => d.university_id && d.university_name && m.set(d.university_id, d.university_name));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [deck]);
  const active = Object.values(filters).filter(Boolean).length;

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold md:text-4xl">{pp.title}</h1>
        {tab === "discover" && (
          <Button variant="outline" size="sm" onClick={() => { setDraft(filters); setSheet(true); }} aria-label={pp.filters}>
            <SlidersHorizontal className="h-4 w-4" /> {pp.filters} {active > 0 && `· ${active}`}
          </Button>
        )}
      </div>
      <div className="mt-5">
        <MatchesStrip />
      </div>
      <div className="mt-6 flex w-fit rounded-xl bg-muted p-1" role="tablist">
        {(["discover", "groups"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => navigate({ search: k === "groups" ? { tab: "groups" } : {} })}
            className={cn("rounded-lg px-4 py-1.5 text-sm font-medium", tab === k ? "bg-card text-primary shadow-soft" : "text-muted-foreground")}
          >
            {k === "discover" ? pp.discover : pp.groups}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "groups" ? (
          <GroupsTab prefill={{ course: search.course, topic: search.topic, create: search.create }} />
        ) : scored ? (
          <SwipeDeck cards={cards} courseNames={me?.courseNames ?? {}} onMatch={setMatch} />
        ) : (
          <div className="mx-auto h-[min(64vh,560px)] max-w-md animate-pulse rounded-[2rem] bg-muted" />
        )}
      </div>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl md:inset-x-auto md:right-8 md:w-[26rem]">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">{pp.filters}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-4">
            <FilterSelect id="f-course" label={pp.filterCourse} value={draft.course} onChange={(v) => setDraft({ ...draft, course: v })}
              options={(me?.courses ?? []).map((c) => [c.id, c.name])} />
            <FilterSelect id="f-uni" label={pp.filterUni} value={draft.uni} onChange={(v) => setDraft({ ...draft, uni: v })} options={unis} />
            <FilterSelect id="f-slot" label={pp.filterSlot} value={draft.slot} onChange={(v) => setDraft({ ...draft, slot: v })}
              options={Object.entries(o.s3.slots)} />
            <FilterSelect id="f-look" label={pp.filterLooking} value={draft.looking} onChange={(v) => setDraft({ ...draft, looking: v })}
              options={Object.entries(o.lookingFor).map(([k, v]) => [k, v.title])} />
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setDraft(noFilters); setFilters(noFilters); setSheet(false); }}>
                {pp.reset}
              </Button>
              <Button className="flex-1" onClick={() => { setFilters(draft); setSheet(false); }}>{pp.apply}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AnimatePresence>
        {match && me && (
          <MatchCelebration
            match={match}
            me={{ archetype: me.archetype, social: me.profile.likert.social }}
            onClose={() => setMatch(null)}
            onMessage={() => navigate({ to: "/chat/$chatId", params: { chatId: match.chatId } })}
            onPropose={() => { setPropose(match); setMatch(null); }}
          />
        )}
      </AnimatePresence>
      <ProposeSessionDialog
        open={!!propose}
        onOpenChange={(v) => !v && setPropose(null)}
        chatId={propose?.chatId}
        inviteeId={propose?.other.candidate_id}
        courseId={propose?.other.shared_course_ids[0]}
      />
    </AppShell>
  );
}

function FilterSelect({ id, label, value, onChange, options }: {
  id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{pp.any}</option>
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}
