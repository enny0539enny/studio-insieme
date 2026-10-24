import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Check, Clock, MoveRight, Play, SkipForward } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { regeneratePlan } from "@/lib/plan-client";
import { classTopics, type Weight } from "@/lib/planner";
import { COURSE_BG, type Dashboard, type DashSession } from "@/lib/dashboard";
import { FocusTimer } from "./TodaySection";
import { t, locale } from "@/i18n";
import { cn } from "@/lib/utils";

const d = t.dash;
const dd = t.dash.detail;
const hm = (x: Date) => x.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

export type DetailTarget = { kind: "session"; id: string } | { kind: "class"; id: string } | null;

/** Detail panel for a study/review session or a class: side panel on desktop, bottom sheet on mobile. */
export function SessionDetail({ data, target, onClose }: { data: Dashboard; target: DetailTarget; onClose: () => void }) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const [focus, setFocus] = useState<DashSession | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);

  const session = target?.kind === "session" ? data.sessions.find((s) => s.id === target.id) : undefined;
  const course = data.courses.find((c) =>
    session ? c.id === session.course_id : c.class_events.some((e) => e.id === target?.id),
  );
  const classEvent = course?.class_events.find((e) => e.id === (session ? session.class_event_id : target?.id));
  if (!target || !course) return null;

  const start = new Date(session ? session.starts_at : classEvent!.starts_at);
  const end = new Date(session ? session.ends_at : classEvent!.ends_at);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const type = !session ? dd.class : session.kind === "review" ? dd.review : session.kind === "exam_review" ? dd.examReview : dd.study;

  const topicIds = session
    ? session.topic_ids
    : (classTopics(course.class_events.map((e) => ({ id: e.id, start: new Date(e.starts_at) })), course.topics.map((tp) => ({ id: tp.id, weight: tp.weight as Weight, sortOrder: tp.sort_order })))[target.id] ?? []);
  const stats = data.courseStats.find((s) => s.courseId === course.id);
  const topics = topicIds
    .map((id) => {
      const tp = course.topics.find((x) => x.id === id);
      return tp ? { ...tp, mastery: stats?.mastery.find((m) => m.id === id)?.mastery ?? 0 } : null;
    })
    .filter((x) => x != null);

  const editable = session && session.status === "planned";
  const refresh = () => qc.invalidateQueries({ queryKey: ["dashboard"] });

  async function markDone() {
    if (!session) return;
    setBusy(true);
    await supabase.from("study_sessions_planned").update({ status: "completed", actual_minutes: minutes }).eq("id", session.id);
    await refresh();
    setBusy(false);
    toast.success(dd.doneToast);
    onClose();
  }
  async function skip() {
    if (!session) return;
    setBusy(true);
    await supabase.from("study_sessions_planned").update({ status: "missed" }).eq("id", session.id);
    await regeneratePlan(data.uid);
    await refresh();
    setBusy(false);
    toast(dd.skipped);
    onClose();
  }
  async function move() {
    if (!session || !moveTo) return;
    const s = new Date(moveTo);
    if (Number.isNaN(s.getTime()) || s <= new Date()) return;
    setBusy(true);
    await supabase
      .from("study_sessions_planned")
      .update({ starts_at: s.toISOString(), ends_at: new Date(s.getTime() + minutes * 60000).toISOString(), is_manual: true })
      .eq("id", session.id);
    await regeneratePlan(data.uid);
    await refresh();
    setBusy(false);
    setMoving(false);
    onClose();
  }

  return (
    <>
      <Sheet open={!!target} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={cn("overflow-y-auto", isMobile ? "max-h-[85vh] rounded-t-3xl" : "w-full sm:max-w-md")}>
          <SheetHeader>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <span className={cn("h-2.5 w-2.5 rounded-full", !session ? "bg-class" : COURSE_BG[course.colorIndex])} />
              {type}
            </p>
            <SheetTitle className="font-display text-2xl">{course.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 px-4 pb-6">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {start.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })} · {hm(start)}–{hm(end)} · {d.minutes(minutes)}
            </p>
            {session?.kind === "review" && classEvent && (
              <p className="rounded-2xl bg-accent p-3 text-sm text-accent-foreground">
                {dd.covers(course.name, `${hm(new Date(classEvent.starts_at))}–${hm(new Date(classEvent.ends_at))}`)}
              </p>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{dd.topics}</p>
              <ul className="mt-2 space-y-2" data-testid="detail-topics">
                {topics.map((tp) => (
                  <li key={tp.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{tp.name}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tp.weight === "high" ? "bg-primary/15 text-primary" : tp.weight === "medium" ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground")}>
                        {t.weight[tp.weight as Weight]}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-secondary" style={{ width: `${tp.mastery}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{dd.mastery(tp.mastery)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {session && (
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={!editable || busy} onClick={() => setFocus(session)}><Play className="h-4 w-4" /> {d.start}</Button>
                <Button variant="outline" asChild>
                  <Link to="/studio"><BookOpen className="h-4 w-4" /> {dd.openTutor}</Link>
                </Button>
                <Button variant="outline" disabled={!editable || busy} onClick={() => setMoving((m) => !m)}><MoveRight className="h-4 w-4" /> {dd.move}</Button>
                <Button variant="outline" disabled={!editable || busy} onClick={markDone}><Check className="h-4 w-4" /> {dd.markDone}</Button>
                <Button variant="ghost" className="col-span-2" disabled={!editable || busy} onClick={skip}><SkipForward className="h-4 w-4" /> {dd.skip}</Button>
              </div>
            )}
            {moving && (
              <div className="flex gap-2">
                <Input type="datetime-local" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />
                <Button disabled={!moveTo || busy} onClick={move}>{dd.moveSave}</Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <FocusTimer session={focus} name={course.name} onClose={() => { setFocus(null); onClose(); }} />
    </>
  );
}
