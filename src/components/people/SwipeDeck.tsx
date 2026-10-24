import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Heart, MapPin, RotateCcw, Sparkles, Target, X } from "lucide-react";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { supabase } from "@/integrations/supabase/client";
import { compatibility, matchLabel, whyLine, type DeckCandidate, type Profile } from "@/lib/compat";
import type { DeckRow } from "@/lib/social";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const pp = t.people;
const o = t.onboarding;
type Arche = keyof typeof t.archetypes;
const slotLabel = (s: string) => (o.s3.slots as Record<string, string>)[s] ?? s;
const placeLabel = (s: string) => (o.s3.places as Record<string, string>)[s] ?? s;
const lfLabel = (s: string) => (o.lookingFor as Record<string, { title: string }>)[s]?.title ?? s;

export type Scored = DeckRow & { score: number; why: string; candidate: DeckCandidate };

export function scoreDeck(rows: DeckRow[], me: Profile, upcoming: string[], courseNames: Record<string, string>): Scored[] {
  return rows
    .map((r) => {
      const candidate: DeckCandidate = {
        id: r.candidate_id,
        firstName: r.first_name,
        likert: { explain: 3, silence: 3, plan: 3, social: 3, ...(r.likert ?? {}) },
        lookingFor: r.looking_for,
        groupSize: r.group_size,
        places: r.places ?? [],
        timeSlots: r.time_slots ?? [],
        tags: r.tags ?? [],
        languages: r.languages ?? [],
        sharedCourseIds: r.shared_course_ids ?? [],
      };
      return {
        ...r,
        candidate,
        score: compatibility(me, candidate, upcoming),
        why: whyLine(me, candidate, courseNames, slotLabel, lfLabel, pp.why),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export type MatchResult = { other: Scored; chatId: string; course: string | null };

export function SwipeDeck({
  cards,
  courseNames,
  onMatch,
}: {
  cards: Scored[];
  courseNames: Record<string, string>;
  onMatch: (m: MatchResult) => void;
}) {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<Scored[]>(cards);
  const [skipped, setSkipped] = useState<Scored[]>([]);
  const [dir, setDir] = useState(1);
  const busy = useRef(false);
  const ids = useMemo(() => cards.map((c) => c.candidate_id).join(), [cards]);
  useEffect(() => setQueue(cards), [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const top = queue[0];

  const decide = useCallback(
    async (liked: boolean) => {
      if (!top || busy.current) return;
      busy.current = true;
      setDir(liked ? 1 : -1);
      setQueue((q) => q.slice(1));
      if (!liked) setSkipped((s) => [top, ...s].slice(0, 20));
      const { data, error } = await supabase.rpc("swipe", { _target: top.candidate_id, _liked: liked });
      busy.current = false;
      if (error) {
        toast.error(error.message);
        return;
      }
      const res = data as { matched?: boolean; chat_id?: string; course?: string | null } | null;
      if (res?.matched && res.chat_id) {
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["chats"] });
        onMatch({ other: top, chatId: res.chat_id, course: res.course ?? null });
      }
    },
    [top, qc, onMatch],
  );

  async function undo() {
    const last = skipped[0];
    if (!last) return;
    setSkipped((s) => s.slice(1));
    await supabase.rpc("undo_swipe", { _target: last.candidate_id });
    setDir(-1);
    setQueue((q) => [last, ...q]);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[min(64vh,560px)] w-full max-w-md">
        {queue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/60 px-8 text-center">
            <Sparkles className="h-8 w-8 text-secondary" strokeWidth={1.5} />
            <p className="mt-4 text-muted-foreground">{pp.empty}</p>
          </div>
        ) : (
          <>
            {queue[1] && (
              <div className="absolute inset-0 translate-y-3 scale-[0.95] opacity-70">
                <CardBody c={queue[1]} courseNames={courseNames} />
              </div>
            )}
            <AnimatePresence custom={dir} initial={false}>
              {top && <SwipeCard key={top.candidate_id} c={top} courseNames={courseNames} onDecide={decide} />}
            </AnimatePresence>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center gap-5">
        <button
          type="button"
          onClick={undo}
          disabled={skipped.length === 0}
          aria-label={pp.undo}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => decide(false)}
          disabled={!top}
          aria-label={pp.pass}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-border bg-card text-foreground shadow-soft transition hover:scale-105 hover:border-foreground/40 disabled:opacity-40"
        >
          <X className="h-7 w-7" />
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          disabled={!top}
          aria-label={pp.imIn}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition hover:scale-105 disabled:opacity-40"
        >
          <Heart className="h-7 w-7" fill="currentColor" />
        </button>
        <span className="w-12" />
      </div>
      <div className="mt-2 flex gap-12 text-xs font-medium text-muted-foreground">
        <span>{pp.pass}</span>
        <span>{pp.imIn}</span>
      </div>
      <p className="mt-3 hidden text-xs text-muted-foreground md:block">{pp.keyboardHint}</p>
    </div>
  );
}

function SwipeCard({ c, courseNames, onDecide }: { c: Scored; courseNames: Record<string, string>; onDecide: (liked: boolean) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-16, 16]);
  const likeOpacity = useTransform(x, [30, 130], [0, 1]);
  const passOpacity = useTransform(x, [-130, -30], [1, 0]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 120 || info.velocity.x > 600) onDecide(true);
    else if (info.offset.x < -120 || info.velocity.x < -600) onDecide(false);
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      initial={{ scale: 0.95, y: 12, opacity: 0.6 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={(d: number) => ({ x: d * 700, rotate: d * 28, opacity: 0, transition: { duration: 0.35 } })}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      data-testid="swipe-card"
    >
      <motion.span
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-6 top-6 z-10 -rotate-12 rounded-xl border-4 border-primary px-3 py-1 font-display text-2xl font-bold uppercase text-primary"
      >
        {pp.imIn}
      </motion.span>
      <motion.span
        style={{ opacity: passOpacity }}
        className="pointer-events-none absolute right-6 top-6 z-10 rotate-12 rounded-xl border-4 border-muted-foreground px-3 py-1 font-display text-2xl font-bold uppercase text-muted-foreground"
      >
        {pp.pass}
      </motion.span>
      <CardBody c={c} courseNames={courseNames} />
    </motion.div>
  );
}

function CardBody({ c, courseNames }: { c: Scored; courseNames: Record<string, string> }) {
  const a = c.archetype ? t.archetypes[c.archetype as Arche] : null;
  const label = matchLabel(c.score);
  return (
    <div className="flex h-full select-none flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-soft">
      <div className="relative flex flex-col items-center bg-gradient-to-b from-accent/70 to-card px-6 pb-4 pt-8">
        <span
          className={cn(
            "absolute right-4 top-4 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            label === "great" ? "bg-primary text-primary-foreground" : "bg-secondary/15 text-secondary",
          )}
        >
          {label === "great" ? pp.great : pp.good}
        </span>
        <ArchetypeAvatar archetype={c.archetype} social={c.candidate.likert.social} className="h-28 w-28 drop-shadow" />
        <p className="mt-3 flex items-center gap-2 font-display text-3xl font-semibold">
          {c.first_name} {c.is_demo && <DemoBadge />}
        </p>
        {a && (
          <p className="mt-1 text-center text-sm">
            <span className="font-semibold text-primary">{a.name}</span>
            <span className="text-muted-foreground"> · {a.tagline}</span>
          </p>
        )}
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {[c.university_name, c.program_name, c.program_year ? pp.year(c.program_year) : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6">
        <p className="rounded-2xl bg-secondary/10 px-4 py-3 text-sm font-medium leading-snug text-foreground">{c.why}</p>
        {c.shared_course_ids.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {c.shared_course_ids.map((id) => (
              <span key={id} className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                {courseNames[id] ?? ""}
              </span>
            ))}
          </div>
        )}
        <dl className="grid grid-cols-1 gap-2 text-sm">
          {c.looking_for && (
            <Row icon={Target} label={pp.lookingFor} value={lfLabel(c.looking_for)} />
          )}
          {c.time_slots.length > 0 && <Row icon={Clock} label={pp.when} value={c.time_slots.map(slotLabel).join(", ")} />}
          {c.places.length > 0 && <Row icon={MapPin} label={pp.where} value={c.places.map(placeLabel).join(", ")} />}
        </dl>
        <div className="mt-auto flex flex-wrap gap-1.5">
          {c.tags.slice(0, 3).map((tg) => (
            <span key={tg} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              {tg}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-secondary" strokeWidth={1.75} />
      <dt className="sr-only">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
