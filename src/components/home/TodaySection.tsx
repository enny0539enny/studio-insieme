import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Play, Square, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { COURSE_BG, type Dashboard, type DashSession } from "@/lib/dashboard";
import { t, locale } from "@/i18n";
import { cn } from "@/lib/utils";

const d = t.dash;
const mins = (s: DashSession) => Math.round((new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000);
const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

export function TodaySection({ data }: { data: Dashboard }) {
  const [focus, setFocus] = useState<DashSession | null>(null);
  const now = new Date();
  const today = data.sessions.filter((s) => new Date(s.starts_at).toDateString() === now.toDateString() && s.status !== "missed");
  const next = data.sessions.find((s) => s.status === "planned" && new Date(s.starts_at) > now);
  const courseOf = (id: string) => data.courses.find((c) => c.id === id);

  const row = (s: DashSession, showDate = false) => {
    const c = courseOf(s.course_id);
    return (
      <div key={s.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <span className={cn("h-12 w-1.5 shrink-0 rounded-full", COURSE_BG[c?.colorIndex ?? 0])} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {c?.name}
            {s.is_review && <span className="ml-2 text-xs font-medium text-primary">{d.review}</span>}
          </p>
          <p className="truncate text-sm text-muted-foreground">{s.topic_ids.map((id) => data.topicNames[id]).filter(Boolean).join(", ")}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
            {showDate && `${new Date(s.starts_at).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} · `}
            {time(s.starts_at)} · {d.minutes(s.status === "completed" ? (s.actual_minutes ?? mins(s)) : mins(s))}
          </p>
        </div>
        {s.status === "completed" ? (
          <span className="flex items-center gap-1 text-sm font-medium text-secondary">
            <Check className="h-4 w-4" /> {d.done}
          </span>
        ) : (
          <Button size="sm" onClick={() => setFocus(s)}>
            <Play className="h-4 w-4" /> {d.start}
          </Button>
        )}
      </div>
    );
  };

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold">{d.today}</h2>
      <div className="mt-4 space-y-3">
        {today.length > 0 ? (
          today.map((s) => row(s))
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{d.nothingToday}</p>
            {next && (
              <>
                <p className="pt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{d.nextSession}</p>
                {row(next, true)}
              </>
            )}
          </>
        )}
        {data.pendingReviews.length > 0 && (
          <div className="flex items-center gap-3 rounded-2xl bg-accent p-4 text-accent-foreground">
            <ClipboardCheck className="h-5 w-5" strokeWidth={1.75} />
            <p className="text-sm font-medium">
              {d.pendingReviews}: {data.pendingReviews.length}
            </p>
          </div>
        )}
      </div>
      <FocusTimer session={focus} name={focus ? courseOf(focus.course_id)?.name ?? "" : ""} onClose={() => setFocus(null)} />
    </section>
  );
}

export function FocusTimer({ session, name, onClose }: { session: DashSession | null; name: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [startedAt, setStartedAt] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    const s = Date.now();
    setStartedAt(s);
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - s) / 1000)), 1000);
    return () => clearInterval(id);
  }, [session]);

  async function stop() {
    if (!session) return;
    setSaving(true);
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    await supabase.from("study_sessions_planned").update({ status: "completed", actual_minutes: minutes }).eq("id", session.id);
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    setSaving(false);
    onClose();
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <Dialog open={!!session} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl text-center">
        <DialogTitle className="font-display text-xl">{d.focusTitle}</DialogTitle>
        <p className="text-sm text-muted-foreground">{name}</p>
        <p className="my-6 font-display text-6xl font-semibold tabular-nums text-primary">
          {mm}:{ss}
        </p>
        <Button size="lg" onClick={stop} disabled={saving}>
          <Square className="h-4 w-4" /> {d.stop}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
