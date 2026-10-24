import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { regeneratePlan } from "@/lib/plan-client";
import { COURSE_BG, type Dashboard } from "@/lib/dashboard";
import { t, locale } from "@/i18n";
import { cn } from "@/lib/utils";

const d = t.dash;

export function PlanWarning({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const warnings = (data.settings?.plan_warnings ?? {}) as Record<string, number>;
  const ids = Object.keys(warnings);
  const reduced = data.settings?.plan_mode === "reduced";
  if (ids.length === 0 && !reduced) return null;

  async function apply(patch: { max_hours_per_day?: number; plan_mode?: string }) {
    setBusy(true);
    await supabase.from("planner_settings").update(patch).eq("user_id", data.uid);
    await regeneratePlan(data.uid);
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    setBusy(false);
  }

  const total = Math.round(ids.reduce((m, id) => m + (warnings[id] ?? 0), 0));
  const names = ids.map((id) => data.courses.find((c) => c.id === id)?.name).filter(Boolean).join(", ");
  return (
    <div className="mt-4 rounded-2xl border border-primary/30 bg-accent p-4">
      {ids.length > 0 && (
        <p className="flex gap-2 text-sm text-accent-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 translate-y-0.5" strokeWidth={1.75} />
          {d.planWarning(total, names)}
        </p>
      )}
      {reduced && <p className="mt-1 text-sm text-accent-foreground">{d.reducedActive}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {ids.length > 0 && (
          <Button size="sm" disabled={busy} onClick={() => apply({ max_hours_per_day: Number(data.settings?.max_hours_per_day ?? 6) + 1 })}>
            {d.addHour}
          </Button>
        )}
        {reduced ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => apply({ plan_mode: "full" })}>
            {d.fullPlan}
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => apply({ plan_mode: "reduced" })}>
            {d.reducedPlan}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ExamsSection({ data }: { data: Dashboard }) {
  const [addFor, setAddFor] = useState<string | null>(null);
  const now = Date.now();
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">{d.exams}</h2>
      <PlanWarning data={data} />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {data.courses.map((c) => {
          const st = data.courseStats.find((s) => s.courseId === c.id)!;
          const exam = c.nextExam;
          const daysLeft = exam ? Math.max(0, Math.ceil((new Date(exam.exam_date).getTime() - now) / 86400000)) : null;
          return (
            <div key={c.id} className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <Link to="/course/$courseId" params={{ courseId: c.id }} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn("mt-1.5 h-3 w-3 shrink-0 rounded-full", COURSE_BG[c.colorIndex])} />
                    <h3 className="font-semibold leading-snug">{c.name}</h3>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {c.credits} {t.home.cfu}
                  </span>
                </div>
                {exam && daysLeft != null && (
                  <p className="mt-3 text-sm">
                    <span className="font-display text-2xl font-semibold">{d.examIn(daysLeft)}</span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(exam.exam_date).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                      {exam.source === "student" && ` · ${d.addedByYou}`}
                    </span>
                  </p>
                )}
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", COURSE_BG[c.colorIndex])} style={{ width: `${Math.min(100, (st.completedH / Math.max(1, st.plannedH)) * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{d.hours(st.completedH, st.plannedH)}</p>
                </div>
                <div className="mt-4 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{d.mastery}</p>
                  {st.mastery.slice(0, 4).map((tp) => (
                    <div key={tp.id} className="flex items-center gap-2">
                      <span className="w-32 truncate text-xs">{tp.name}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-secondary" style={{ width: `${tp.mastery}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                {exam && st.behind && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" /> {d.behind}
                  </p>
                )}
                {exam && !st.behind && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-secondary">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {d.onTrack}
                  </p>
                )}
              </Link>
              {!exam && (
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => setAddFor(c.id)}>
                    <CalendarPlus className="h-4 w-4" /> {d.addExam}
                  </Button>
                  <p className="mt-1.5 text-xs text-muted-foreground">{d.addExamHint}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <AddExamDialog courseId={addFor} uid={data.uid} onClose={() => setAddFor(null)} />
    </section>
  );
}

function AddExamDialog({ courseId, uid, onClose }: { courseId: string | null; uid: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!courseId || !date) return;
    setSaving(true);
    await supabase.from("exams").insert({ course_id: courseId, exam_date: new Date(`${date}T09:00`).toISOString(), source: "student", created_by: uid });
    await regeneratePlan(uid);
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    setSaving(false);
    onClose();
  }
  return (
    <Dialog open={!!courseId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogTitle className="font-display">{d.addExam}</DialogTitle>
        <label className="text-sm font-medium" htmlFor="exam-date">
          {d.examDate}
        </label>
        <Input id="exam-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button onClick={save} disabled={!date || saving}>
          {d.save}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
