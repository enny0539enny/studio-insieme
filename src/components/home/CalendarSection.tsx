import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { regeneratePlan } from "@/lib/plan-client";
import { COURSE_BG, startOfWeek, type Dashboard } from "@/lib/dashboard";
import { t, locale } from "@/i18n";
import { cn } from "@/lib/utils";

const d = t.dash;
const HOUR_PX = 44;
const FIRST_HOUR = 8;
const LAST_HOUR = 23;

type Item = {
  id: string;
  kind: "class" | "session" | "exam";
  start: Date;
  end: Date;
  title: string;
  subtitle?: string | undefined;
  colorIndex: number;
  draggable: boolean;
  attended?: boolean | undefined;
  status?: string | undefined;
};

const addDays = (x: Date, n: number) => new Date(x.getFullYear(), x.getMonth(), x.getDate() + n);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const hm = (x: Date) => x.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

export function CalendarSection({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ id: string; offsetMin: number; durMin: number } | null>(null);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const c of data.courses) {
      for (const e of c.class_events)
        out.push({
          id: e.id,
          kind: "class",
          start: new Date(e.starts_at),
          end: new Date(e.ends_at),
          title: c.name,
          subtitle: e.room ?? undefined,
          colorIndex: c.colorIndex,
          draggable: false,
          attended: data.attendedIds.has(e.id),
        });
      for (const e of c.exams)
        out.push({
          id: e.id,
          kind: "exam",
          start: new Date(e.exam_date),
          end: new Date(new Date(e.exam_date).getTime() + 3 * 3600000),
          title: `${d.examLabel}: ${c.name}`,
          subtitle: e.room ?? undefined,
          colorIndex: c.colorIndex,
          draggable: false,
        });
    }
    const now = new Date();
    for (const s of data.sessions) {
      if (s.status === "missed") continue;
      const c = data.courses.find((x) => x.id === s.course_id);
      out.push({
        id: s.id,
        kind: "session",
        start: new Date(s.starts_at),
        end: new Date(s.ends_at),
        title: c?.name ?? "",
        subtitle: s.topic_ids.map((id) => data.topicNames[id]).filter(Boolean).join(", "),
        colorIndex: c?.colorIndex ?? 0,
        draggable: s.status === "planned" && new Date(s.starts_at) > now,
        status: s.status,
      });
    }
    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [data]);

  async function moveSession(id: string, start: Date, durMin: number) {
    setBusy(true);
    await supabase
      .from("study_sessions_planned")
      .update({ starts_at: start.toISOString(), ends_at: new Date(start.getTime() + durMin * 60000).toISOString(), is_manual: true })
      .eq("id", id);
    await regeneratePlan(data.uid);
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    setBusy(false);
  }

  async function toggleAttended(it: Item) {
    if (it.kind !== "class") return;
    if (it.attended) {
      await supabase.from("attendance").delete().eq("user_id", data.uid).eq("class_event_id", it.id).eq("source", "self");
    } else {
      await supabase.from("attendance").upsert({ user_id: data.uid, class_event_id: it.id, attended: true, source: "self" }, { onConflict: "user_id,class_event_id" });
      toast.success(d.attended);
    }
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const shift = (n: number) =>
    setAnchor((a) => (view === "week" ? addDays(a, 7 * n) : new Date(a.getFullYear(), a.getMonth() + n, 1)));
  const title =
    view === "week"
      ? `${days[0]!.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${days[6]!.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`
      : anchor.toLocaleDateString(locale, { month: "long", year: "numeric" });

  const blockClass = (it: Item) =>
    cn(
      "overflow-hidden rounded-lg px-2 py-1 text-[11px] leading-tight",
      it.kind === "class" && "bg-class text-foreground",
      it.kind === "exam" && "bg-exam font-semibold text-primary-foreground ring-2 ring-exam/30",
      it.kind === "session" && cn(COURSE_BG[it.colorIndex], "text-primary-foreground", it.status === "completed" && "opacity-60"),
      it.draggable && "cursor-grab active:cursor-grabbing",
    );

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">{d.calendar}</h2>
        <div className="hidden items-center gap-2 md:flex">
          <div className="flex rounded-xl bg-muted p-1">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", view === v ? "bg-card text-primary shadow-soft" : "text-muted-foreground")}
              >
                {v === "week" ? d.week : d.month}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
            {d.todayBtn}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Desktop: week / month */}
      <div className={cn("mt-4 hidden rounded-3xl border border-border bg-card p-4 shadow-soft md:block", busy && "pointer-events-none opacity-60")}>
        <p className="mb-3 text-sm font-semibold">{title}</p>
        {view === "week" ? (
          <>
            <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1">
              <div />
              {days.map((day) => (
                <div key={day.toISOString()} className={cn("pb-2 text-center text-xs", sameDay(day, new Date()) ? "font-bold text-primary" : "text-muted-foreground")}>
                  {day.toLocaleDateString(locale, { weekday: "short", day: "numeric" })}
                </div>
              ))}
              <div className="relative" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
                {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
                  <span key={i} className="absolute right-1 text-[10px] text-muted-foreground" style={{ top: i * HOUR_PX - 6 }}>
                    {FIRST_HOUR + i}:00
                  </span>
                ))}
              </div>
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className="relative rounded-lg bg-muted/40"
                  style={{
                    height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX,
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px, var(--border) ${HOUR_PX}px)`,
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const g = drag.current;
                    if (!g) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const min = FIRST_HOUR * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60 - g.offsetMin;
                    const snapped = Math.max(FIRST_HOUR * 60, Math.min(LAST_HOUR * 60 - g.durMin, Math.round(min / 15) * 15));
                    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, snapped);
                    drag.current = null;
                    if (start > new Date()) moveSession(g.id, start, g.durMin);
                  }}
                >
                  {items
                    .filter((it) => sameDay(it.start, day))
                    .map((it) => {
                      const top = ((it.start.getHours() * 60 + it.start.getMinutes() - FIRST_HOUR * 60) / 60) * HOUR_PX;
                      const height = Math.max(18, ((it.end.getTime() - it.start.getTime()) / 3600000) * HOUR_PX - 2);
                      const durMin = (it.end.getTime() - it.start.getTime()) / 60000;
                      return (
                        <div
                          key={it.kind + it.id}
                          draggable={it.draggable}
                          onDragStart={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            drag.current = { id: it.id, durMin, offsetMin: ((e.clientY - rect.top) / HOUR_PX) * 60 };
                          }}
                          onClick={() => toggleAttended(it)}
                          title={`${it.title}${it.subtitle ? ` · ${it.subtitle}` : ""}${it.kind === "class" ? ` · ${it.attended ? d.attended : d.markAttended}` : ""}`}
                          className={cn("absolute inset-x-0.5", blockClass(it), it.kind === "class" && "cursor-pointer")}
                          style={{ top: Math.max(0, top), height }}
                        >
                          <p className="truncate font-semibold">
                            {it.kind === "class" && it.attended && <Check className="mr-0.5 inline h-3 w-3" />}
                            {it.title}
                          </p>
                          {height > 30 && <p className="truncate opacity-80">{hm(it.start)} {it.subtitle}</p>}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{d.dragHint}</p>
          </>
        ) : (
          <MonthGrid anchor={anchor} items={items} blockClass={blockClass} />
        )}
      </div>

      {/* Mobile: agenda */}
      <div className="mt-4 space-y-4 md:hidden">
        {Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)).map((day) => {
          const list = items.filter((it) => sameDay(it.start, day));
          return (
            <div key={day.toISOString()}>
              <p className={cn("text-xs font-semibold uppercase tracking-widest", i0(day) ? "text-primary" : "text-muted-foreground")}>
                {day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short" })}
              </p>
              <div className="mt-2 space-y-1.5">
                {list.length === 0 && <p className="text-sm text-muted-foreground">{d.noItems}</p>}
                {list.map((it) => (
                  <div key={it.kind + it.id} className="flex items-center gap-3 rounded-xl bg-card p-2.5 shadow-soft">
                    <span
                      className={cn(
                        "h-9 w-1.5 shrink-0 rounded-full",
                        it.kind === "class" ? "bg-class" : it.kind === "exam" ? "bg-exam" : COURSE_BG[it.colorIndex],
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm font-medium", it.kind === "exam" && "text-exam")}>
                        {it.kind === "class" && <GraduationCap className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />}
                        {it.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {hm(it.start)}–{hm(it.end)} {it.subtitle && `· ${it.subtitle}`}
                      </p>
                    </div>
                    {it.kind === "class" && (
                      <button
                        onClick={() => toggleAttended(it)}
                        className={cn(
                          "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                          it.attended ? "border-secondary bg-secondary/10 text-secondary" : "border-border text-muted-foreground",
                        )}
                      >
                        {it.attended ? d.attended : d.markAttended}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const i0 = (day: Date) => sameDay(day, new Date());

function MonthGrid({ anchor, items, blockClass }: { anchor: Date; items: Item[]; blockClass: (it: Item) => string }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.slice(0, 7).map((c) => (
        <div key={"h" + c.toISOString()} className="pb-1 text-center text-xs text-muted-foreground">
          {c.toLocaleDateString(locale, { weekday: "short" })}
        </div>
      ))}
      {cells.map((c) => {
        const list = items.filter((it) => sameDay(it.start, c) && it.kind !== "class");
        const ordered = [...list.filter((x) => x.kind === "exam"), ...list.filter((x) => x.kind !== "exam")];
        const classes = items.filter((it) => sameDay(it.start, c) && it.kind === "class").length;
        return (
          <div key={c.toISOString()} className={cn("min-h-24 rounded-lg p-1.5", c.getMonth() === anchor.getMonth() ? "bg-muted/40" : "opacity-40")}>
            <p className={cn("text-xs", i0(c) ? "font-bold text-primary" : "text-muted-foreground")}>{c.getDate()}</p>
            <div className="mt-1 space-y-0.5">
              {ordered.slice(0, 3).map((it) => (
                <div key={it.id} className={blockClass(it)}>
                  <p className="truncate">{it.title}</p>
                </div>
              ))}
              {ordered.length > 3 && <p className="text-[10px] text-muted-foreground">{d.more(ordered.length - 3)}</p>}
              {classes > 0 && <p className="text-[10px] text-muted-foreground">{classes} × {d.classLabel.toLowerCase()}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
