import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Coffee, MessagesSquare, Swords, CalendarCheck, Zap, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import {
  computeArchetype,
  matchFacts,
  pickMatch,
  type ArchetypeKey,
  type Candidate,
  type Likert,
  type LookingFor,
  type Me,
  type Scenario,
} from "@/lib/archetype";
import { t, locale } from "@/i18n";
import { cn } from "@/lib/utils";

const o = t.onboarding;

const onboardingQuery = queryOptions({
  queryKey: ["onboarding-context"],
  queryFn: async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user!.id;
    const [profile, enrollments] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, universities(name), degree_programs(name)")
        .eq("id", uid)
        .single(),
      supabase.from("enrollments").select("courses(id, name, exams(exam_date))").eq("user_id", uid),
    ]);
    const courses = (enrollments.data ?? []).map((e) => e.courses).filter((c) => c != null);
    const now = Date.now();
    return {
      uid,
      fullName: profile.data?.full_name ?? "",
      university: profile.data?.universities?.name ?? "",
      program: profile.data?.degree_programs?.name ?? "",
      courseNames: Object.fromEntries(courses.map((c) => [c.id, c.name])) as Record<string, string>,
      upcomingExamCourseIds: courses
        .filter((c) => c.exams.some((e) => new Date(e.exam_date).getTime() > now))
        .map((c) => c.id),
    };
  },
});

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — UniMate" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(onboardingQuery),
  component: OnboardingPage,
});

type Answers = {
  step: number;
  name: string;
  likert: Partial<Likert>;
  scenario?: Scenario;
  lookingFor?: LookingFor;
  groupSize?: "pair" | "small" | "depends";
  places: string[];
  timeSlots: string[];
  living?: "commuter" | "moved" | "local";
  tags: string[];
  mapAllowed: boolean;
};

type Reveal = { archetype: ArchetypeKey; social: number; tags: string[]; match: Candidate | null; line: string };

const lookingIcons: Record<LookingFor, typeof Coffee> = {
  quiet: Coffee,
  review: MessagesSquare,
  sparring: Swords,
  coach: CalendarCheck,
  unblock: Zap,
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function buildMatchLine(me: Me, c: Candidate, courseNames: Record<string, string>): string {
  const f = matchFacts(me, c);
  const name = c.first_name;
  const phrases: string[] = [];
  const explain =
    f.explainOpposite === "theyExplain" ? t.match.theyExplain(name) : f.explainOpposite === "youExplain" ? t.match.youExplain(name) : null;
  if ((me.lookingFor === "review" || me.lookingFor === "sparring") && explain) phrases.push(explain);
  if (me.lookingFor === "quiet" && f.bothSilent) phrases.push(t.match.bothSilent);
  if (me.lookingFor === "coach" && f.bothPlan) phrases.push(f.bothPlan === "plan" ? t.match.bothPlan : t.match.bothSprint);
  if (explain && !phrases.includes(explain)) phrases.push(explain);
  if (f.sharedExamCourseId && courseNames[f.sharedExamCourseId]) phrases.push(t.match.sharedExam(courseNames[f.sharedExamCourseId]));
  if (f.sharedSlot) {
    const slot = o.s3.slots[f.sharedSlot as keyof typeof o.s3.slots];
    if (slot) phrases.push(t.match.sharedSlot(slot.toLowerCase()));
  }
  const picked = phrases.slice(0, 2);
  if (picked.length === 0 && f.sharedCourseId && courseNames[f.sharedCourseId]) {
    picked.push(t.match.sharedCourse(courseNames[f.sharedCourseId]));
  }
  return capitalize(picked.join(", and ")) + ".";
}

function OnboardingPage() {
  const ctx = useSuspenseQuery(onboardingQuery).data;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const storageKey = `unimate-onboarding-${ctx.uid}`;
  const firstName = ctx.fullName.split(" ")[0] ?? "";

  const [a, setA] = useState<Answers>({
    step: 0,
    name: firstName,
    likert: {},
    places: [],
    timeSlots: [],
    tags: [],
    mapAllowed: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);

  // Restore saved progress after hydration.
  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      try {
        setA((prev) => ({ ...prev, ...JSON.parse(raw) }));
      } catch {
        /* ignore corrupt draft */
      }
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (loaded) localStorage.setItem(storageKey, JSON.stringify(a));
  }, [a, loaded, storageKey]);

  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }));

  const valid = useMemo(() => {
    switch (a.step) {
      case 0:
        return a.name.trim().length > 0;
      case 1:
        return ["explain", "silence", "plan", "social"].every((k) => a.likert[k as keyof Likert]) && !!a.scenario;
      case 2:
        return !!a.lookingFor;
      case 3:
        return !!a.groupSize && a.places.length > 0 && a.timeSlots.length > 0 && !!a.living;
      case 4:
        return a.tags.length > 0;
      default:
        return false;
    }
  }, [a]);

  async function submit() {
    setSaving(true);
    try {
      const likert = a.likert as Likert;
      const archetype = computeArchetype(likert, a.scenario!, a.lookingFor!);
      const name = a.name.trim();
      if (name !== firstName) {
        await supabase.from("profiles").update({ full_name: name }).eq("id", ctx.uid);
      }
      const { error } = await supabase.from("student_profiles").upsert({
        user_id: ctx.uid,
        archetype,
        likert_answers: likert,
        exam_scenario: a.scenario,
        looking_for: a.lookingFor,
        group_size: a.groupSize,
        places: a.places,
        time_slots: a.timeSlots,
        living_situation: a.living,
        tags: a.tags,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await supabase.from("privacy_settings").update({ map_active_allowed: a.mapAllowed }).eq("user_id", ctx.uid);

      const { data: rows } = await supabase.rpc("get_match_candidates");
      const me: Me = {
        likert,
        lookingFor: a.lookingFor!,
        timeSlots: a.timeSlots,
        tags: a.tags,
        upcomingExamCourseIds: ctx.upcomingExamCourseIds,
      };
      const match = pickMatch(me, (rows ?? []) as unknown as Candidate[]);
      setReveal({
        archetype,
        social: likert.social,
        tags: a.tags,
        match,
        line: match ? buildMatchLine(me, match, ctx.courseNames) : "",
      });
      localStorage.removeItem(storageKey);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } finally {
      setSaving(false);
    }
  }

  if (reveal) return <RevealScreen r={reveal} onHome={() => navigate({ to: "/home" })} onMore={() => navigate({ to: "/persone" })} />;

  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-5 pb-10 pt-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => set({ step: Math.max(0, a.step - 1) })}
            className={cn("rounded-full p-2 text-muted-foreground hover:bg-accent", a.step === 0 && "invisible")}
            aria-label={o.back}
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div className="flex gap-2" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === a.step ? "w-6 bg-primary" : i < a.step ? "w-2 bg-primary/50" : "w-2 bg-border",
                )}
              />
            ))}
          </div>
          <span className="w-9" />
        </div>

        <div key={a.step} className="mt-8 flex-1 animate-fade-up">
          {a.step === 0 && (
            <Screen title={o.s0.title} caption={o.s0.subtitle} big>
              <label className="block text-sm font-semibold" htmlFor="ob-name">
                {o.s0.nameLabel}
              </label>
              <Input
                id="ob-name"
                className="mt-2 h-12 text-base"
                placeholder={o.s0.namePlaceholder}
                value={a.name}
                onChange={(e) => set({ name: e.target.value })}
              />
              <div className="mt-6 rounded-2xl border border-border bg-card/70 p-4">
                <p className="text-sm font-medium">
                  {ctx.program}
                  {ctx.university && ` · ${ctx.university}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{o.s0.fromUniversity}</p>
              </div>
            </Screen>
          )}

          {a.step === 1 && (
            <Screen title={o.s1.title} caption={o.s1.caption}>
              <div className="space-y-6">
                {o.s1.rows.map((row) => (
                  <LikertRow
                    key={row.key}
                    left={row.left}
                    right={row.right}
                    value={a.likert[row.key as keyof Likert]}
                    onChange={(v) => set({ likert: { ...a.likert, [row.key]: v } })}
                  />
                ))}
              </div>
              <h2 className="mt-10 font-display text-xl font-semibold">{o.s1.scenarioTitle}</h2>
              <div className="mt-4 space-y-2">
                {(Object.keys(o.s1.scenarios) as Scenario[]).map((k) => (
                  <ChoiceCard key={k} selected={a.scenario === k} onClick={() => set({ scenario: k })}>
                    <span className="text-sm font-medium">{o.s1.scenarios[k]}</span>
                  </ChoiceCard>
                ))}
              </div>
            </Screen>
          )}

          {a.step === 2 && (
            <Screen title={o.s2.title} caption={o.s2.caption}>
              <div className="space-y-3">
                {(Object.keys(o.lookingFor) as LookingFor[]).map((k) => {
                  const Icon = lookingIcons[k];
                  return (
                    <ChoiceCard key={k} selected={a.lookingFor === k} onClick={() => set({ lookingFor: k })}>
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/12 text-secondary">
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </div>
                        <div>
                          <p className="font-semibold">{o.lookingFor[k].title}</p>
                          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{o.lookingFor[k].text}</p>
                        </div>
                      </div>
                    </ChoiceCard>
                  );
                })}
              </div>
            </Screen>
          )}

          {a.step === 3 && (
            <Screen title={o.s3.title}>
              <Field label={o.s3.groupLabel}>
                <Segmented options={o.s3.group} value={a.groupSize} onChange={(v) => set({ groupSize: v })} />
              </Field>
              <Field label={o.s3.placesLabel}>
                <ChipGroup options={o.s3.places} values={a.places} onChange={(v) => set({ places: v })} />
              </Field>
              <Field label={o.s3.slotsLabel}>
                <ChipGroup options={o.s3.slots} values={a.timeSlots} onChange={(v) => set({ timeSlots: v })} />
              </Field>
              <Field label={o.s3.livingLabel}>
                <Segmented options={o.s3.living} value={a.living} onChange={(v) => set({ living: v })} />
              </Field>
            </Screen>
          )}

          {a.step === 4 && (
            <Screen title={o.s4.title} caption={o.s4.caption}>
              <TagPicker tags={a.tags} onChange={(tags) => set({ tags })} />
              <div className="mt-8 flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex-1">
                  <label htmlFor="ob-map" className="font-semibold">
                    {o.s4.mapLabel}
                  </label>
                  <p className="mt-1 text-sm leading-snug text-muted-foreground">{o.s4.mapCaption}</p>
                </div>
                <Switch id="ob-map" checked={a.mapAllowed} onCheckedChange={(v) => set({ mapAllowed: v })} />
              </div>
            </Screen>
          )}
        </div>

        <Button
          size="lg"
          className="mt-8 h-12 w-full text-base"
          disabled={!valid || saving}
          onClick={() => (a.step < 4 ? set({ step: a.step + 1 }) : submit())}
        >
          {saving ? o.reveal.saving : a.step === 0 ? o.s0.cta : a.step === 4 ? o.s4.cta : o.next}
        </Button>
      </div>
    </div>
  );
}

function Screen({ title, caption, big, children }: { title: string; caption?: string; big?: boolean; children: ReactNode }) {
  return (
    <section>
      <h1 className={cn("font-display font-semibold leading-tight", big ? "text-4xl md:text-5xl" : "text-3xl")}>{title}</h1>
      {caption && <p className="mt-3 text-muted-foreground">{caption}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-7">
      <p className="mb-3 text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

function LikertRow({ left, right, value, onChange }: { left: string; right: string; value?: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <span className="text-sm leading-tight">{left}</span>
      <div className="flex items-center gap-2" role="radiogroup" aria-label={`${left} / ${right}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${left} – ${right}: ${n}/5`}
            onClick={() => onChange(n)}
            className={cn(
              "rounded-full border-2 transition-all",
              n === 3 ? "h-5 w-5" : "h-7 w-7",
              value === n ? "scale-110 border-primary bg-primary" : "border-border bg-card hover:border-primary/50",
            )}
          />
        ))}
      </div>
      <span className="text-right text-sm leading-tight">{right}</span>
    </div>
  );
}

function ChoiceCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border-2 bg-card p-4 text-left transition-all",
        selected ? "border-primary shadow-soft" : "border-transparent hover:border-border",
      )}
    >
      <div className="flex-1">{children}</div>
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

function Segmented<K extends string>({ options, value, onChange }: { options: Record<K, string>; value?: K; onChange: (v: K) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl bg-muted p-1">
      {(Object.keys(options) as K[]).map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={cn(
            "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
            value === k ? "bg-card text-primary shadow-soft" : "text-muted-foreground",
          )}
        >
          {options[k]}
        </button>
      ))}
    </div>
  );
}

function Chip({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-all disabled:opacity-40",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}

function ChipGroup<K extends string>({ options, values, onChange }: { options: Record<K, string>; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(options) as K[]).map((k) => (
        <Chip
          key={k}
          selected={values.includes(k)}
          onClick={() => onChange(values.includes(k) ? values.filter((x) => x !== k) : [...values, k])}
        >
          {options[k]}
        </Chip>
      ))}
    </div>
  );
}

function TagPicker({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState("");
  const full = tags.length >= 3;
  const custom = tags.filter((x) => !o.s4.tags.includes(x));
  const toggle = (x: string) => onChange(tags.includes(x) ? tags.filter((y) => y !== x) : full ? tags : [...tags, x]);

  return (
    <div>
      <p className="mb-3 text-right text-sm font-semibold text-primary">{tags.length}/3</p>
      <div className="flex flex-wrap gap-2">
        {[...o.s4.tags, ...custom].map((x) => (
          <Chip key={x} selected={tags.includes(x)} disabled={full && !tags.includes(x)} onClick={() => toggle(x)}>
            {x}
          </Chip>
        ))}
        {!otherOpen && (
          <Chip selected={false} disabled={full} onClick={() => setOtherOpen(true)}>
            {o.s4.other}
          </Chip>
        )}
      </div>
      {otherOpen && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = other.trim();
            if (v && !full && !tags.includes(v)) onChange([...tags, v]);
            setOther("");
            setOtherOpen(false);
          }}
        >
          <Input autoFocus maxLength={20} value={other} placeholder={o.s4.otherPlaceholder} onChange={(e) => setOther(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={!other.trim() || full}>
            {o.s4.add}
          </Button>
        </form>
      )}
    </div>
  );
}

function RevealScreen({ r, onHome, onMore }: { r: Reveal; onHome: () => void; onMore: () => void }) {
  const info = t.archetypes[r.archetype];
  const m = r.match;
  const mInfo = m?.archetype ? t.archetypes[m.archetype as ArchetypeKey] : null;
  return (
    <div className="min-h-screen bg-hero">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center px-6 pb-10 pt-14 text-center">
        <ArchetypeAvatar archetype={r.archetype} social={r.social} className="h-40 w-40 animate-pop-in drop-shadow-xl" label={info.name} />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-secondary animate-fade-up">{o.reveal.caption}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold animate-fade-up">{info.name}</h1>
        <p className="mt-1 font-display text-lg italic text-primary animate-fade-up">{info.tagline}</p>
        <p className="mt-4 text-muted-foreground animate-fade-up">{info.description}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 animate-fade-up">
          {r.tags.map((x) => (
            <span key={x} className="rounded-full border border-border bg-card px-3 py-1 text-sm">
              {x}
            </span>
          ))}
        </div>

        <div className="my-8 h-px w-full bg-border" />

        {m && mInfo ? (
          <>
            <div className="w-full rounded-3xl border border-border bg-card p-5 text-left shadow-soft animate-fade-up">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{o.reveal.firstMatch}</p>
              <div className="mt-4 flex items-center gap-4">
                <ArchetypeAvatar archetype={m.archetype} social={m.likert.social} className="h-14 w-14" label={mInfo.name} />
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {m.first_name}
                    {m.is_demo && <DemoBadge />}
                  </p>
                  <p className="text-sm text-muted-foreground">{mInfo.name}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed">{r.line}</p>
              {m.next_session && (
                <div className="mt-4 rounded-2xl bg-muted p-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">{o.reveal.nextSession}</p>
                  <p className="mt-1">
                    {new Date(m.next_session.starts_at).toLocaleString(locale, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {m.next_session.place}
                    {m.next_session.looking_for &&
                      o.lookingFor[m.next_session.looking_for as LookingFor] &&
                      ` · ${o.lookingFor[m.next_session.looking_for as LookingFor].title}`}
                  </p>
                </div>
              )}
            </div>
            <Button size="lg" className="mt-8 h-12 w-full text-base" onClick={onHome}>
              {o.reveal.imIn}
            </Button>
            <button onClick={onMore} className="mt-4 text-sm font-medium text-secondary hover:underline">
              {o.reveal.more}
            </button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">{o.reveal.noMatch}</p>
            <Button size="lg" className="mt-8 h-12 w-full text-base" onClick={onHome}>
              {o.reveal.goHome}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
