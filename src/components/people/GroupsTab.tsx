import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { meSocialQuery } from "@/lib/social";
import { selectClass } from "./ProposeSessionDialog";
import { t } from "@/i18n";

const pp = t.people;

export const groupsQuery = queryOptions({
  queryKey: ["groups"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("study_groups")
      .select("id, name, description, course_id, is_public, organizer_id, courses(name), course_topics(name), group_members(user_id)")
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  },
});

export async function joinGroup(qc: ReturnType<typeof useQueryClient>, id: string) {
  const { error } = await supabase.rpc("join_group", { _group: id });
  if (error) return toast.error(error.message);
  toast.success(pp.joined);
  qc.invalidateQueries({ queryKey: ["groups"] });
  qc.invalidateQueries({ queryKey: ["group", id] });
}

export function GroupsTab({ prefill }: { prefill?: { course?: string | undefined; topic?: string | undefined; create?: boolean | undefined } }) {
  const qc = useQueryClient();
  const { data: me } = useQuery(meSocialQuery);
  const { data: groups = [] } = useQuery(groupsQuery);
  const [open, setOpen] = useState(!!prefill?.create);
  useEffect(() => {
    if (prefill?.create) setOpen(true);
  }, [prefill?.create]);

  const byCourse = new Map<string, typeof groups>();
  for (const g of groups) {
    const k = g.courses?.name ?? "—";
    byCourse.set(k, [...(byCourse.get(k) ?? []), g]);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{pp.groupsByCourse}</h2>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> {pp.createGroup}
        </Button>
      </div>
      {groups.length === 0 && <p className="mt-6 text-muted-foreground">{pp.noGroups}</p>}
      <div className="mt-4 space-y-6">
        {[...byCourse.entries()].map(([course, list]) => (
          <div key={course}>
            <h3 className="font-display text-lg font-semibold">{course}</h3>
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {list.map((g) => {
                const member = g.group_members.some((m) => m.user_id === me?.uid);
                return (
                  <li key={g.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft">
                    <Link to="/groups/$groupId" params={{ groupId: g.id }} className="font-semibold hover:text-primary">
                      {g.name}
                    </Link>
                    {g.course_topics?.name && <p className="text-xs text-secondary">{g.course_topics.name}</p>}
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> {pp.members(g.group_members.length)}
                      </span>
                      {member ? (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/groups/$groupId" params={{ groupId: g.id }}>{pp.groupChat}</Link>
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => joinGroup(qc, g.id)}>
                          {pp.join}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <CreateGroupDialog open={open} onOpenChange={setOpen} courseId={prefill?.course} topicId={prefill?.topic} />
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  courseId,
  topicId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courseId?: string | undefined;
  topicId?: string | undefined;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery(meSocialQuery);
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [topic, setTopic] = useState("");
  const [desc, setDesc] = useState("");
  const [isPublic, setPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !me) return;
    const c = courseId && me.courses.some((x) => x.id === courseId) ? courseId : (me.courses[0]?.id ?? "");
    setCourse(c);
    setTopic(topicId ?? "");
    const tp = me.courses.find((x) => x.id === c)?.topics.find((x) => x.id === topicId);
    if (tp) setName((n) => n || `${tp.name} study group`);
  }, [open, me, courseId, topicId]);

  const topics = me?.courses.find((c) => c.id === course)?.topics ?? [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_group", {
      _name: name,
      _course: course || (null as unknown as string),
      _topic: topic || (null as unknown as string),
      _description: desc,
      _public: isPublic,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["groups"] });
    onOpenChange(false);
    navigate({ to: "/groups/$groupId", params: { groupId: data as string } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{pp.createGroup}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-name">{pp.groupName}</Label>
            <Input id="g-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-course">{pp.propose.course}</Label>
            <select id="g-course" className={selectClass} value={course} onChange={(e) => { setCourse(e.target.value); setTopic(""); }}>
              {me?.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-topic">{pp.topic}</Label>
            <select id="g-topic" className={selectClass} value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">{pp.noTopic}</option>
              {topics.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-desc">{pp.groupDesc}</Label>
            <Textarea id="g-desc" maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <label className="flex items-center justify-between text-sm font-medium">
            {pp.publicGroup}
            <Switch checked={isPublic} onCheckedChange={setPublic} />
          </label>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{pp.create}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
