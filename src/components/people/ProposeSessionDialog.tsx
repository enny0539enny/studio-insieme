import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { meSocialQuery, venuesQuery } from "@/lib/social";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

const p = t.people.propose;
export const selectClass =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function defaultStart() {
  const d = new Date(Date.now() + 86400000);
  d.setHours(16, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T16:00`;
}

export function ProposeSessionDialog({
  open,
  onOpenChange,
  inviteeId,
  chatId,
  groupId,
  courseId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  inviteeId?: string | null | undefined;
  chatId?: string | null | undefined;
  groupId?: string | null | undefined;
  courseId?: string | null | undefined;
}) {
  const qc = useQueryClient();
  const { data: me } = useQuery(meSocialQuery);
  const { data: venues = [] } = useQuery(venuesQuery);
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [minutes, setMinutes] = useState(90);
  const [venue, setVenue] = useState("00000000-0000-0000-0000-000000000501");
  const [max, setMax] = useState(groupId ? 6 : 2);
  const [visibility, setVisibility] = useState<"public" | "invite">(groupId ? "public" : "invite");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setCourse(courseId ?? me?.courses[0]?.id ?? "");
  }, [open, courseId, me]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const online = venue === "online";
    const { error } = await supabase.rpc("propose_session", {
      _title: title.trim() || p.namePh.replace("e.g. ", ""),
      _course: course || (null as unknown as string),
      _starts: new Date(start).toISOString(),
      _minutes: minutes,
      _venue: online ? (null as unknown as string) : venue,
      _online: online,
      _max: max,
      _visibility: visibility,
      _invitee: (inviteeId ?? null) as unknown as string,
      _chat: (chatId ?? null) as unknown as string,
      _group: (groupId ?? null) as unknown as string,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(p.done);
    ["dashboard", "group-sessions", "group", "chats"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    if (chatId) qc.invalidateQueries({ queryKey: ["chat", chatId] });
    onOpenChange(false);
    setTitle("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{p.title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ps-title">{p.name}</Label>
            <Input id="ps-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={p.namePh} maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-course">{p.course}</Label>
            <select id="ps-course" className={selectClass} value={course} onChange={(e) => setCourse(e.target.value)}>
              {me?.courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="ps-start">{p.date}</Label>
              <Input id="ps-start" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="ps-dur">{p.duration}</Label>
              <select id="ps-dur" className={selectClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[30, 60, 90, 120, 180, 240].map((m) => (
                  <option key={m} value={m}>{p.minutes(m)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ps-venue">{p.venue}</Label>
            <select id="ps-venue" className={selectClass} value={venue} onChange={(e) => setVenue(e.target.value)}>
              <option value="online">{p.online}</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ps-max">{p.max}</Label>
              <Input id="ps-max" type="number" min={2} max={30} value={max} onChange={(e) => setMax(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>{p.visibility}</Label>
              <div className="flex rounded-xl bg-muted p-1">
                {(["invite", "public"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={cn("flex-1 rounded-lg py-1.5 text-xs font-medium", visibility === v ? "bg-card text-primary shadow-soft" : "text-muted-foreground")}
                  >
                    {v === "public" ? p.public : p.invite}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {p.submit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
