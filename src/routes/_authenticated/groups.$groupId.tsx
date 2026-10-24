import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarPlus, MapPin, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DemoBadge } from "@/components/DemoBadge";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/ChatThread";
import { ProposeSessionDialog } from "@/components/people/ProposeSessionDialog";
import { joinGroup } from "@/components/people/GroupsTab";
import { supabase } from "@/integrations/supabase/client";
import { meSocialQuery, sessionState } from "@/lib/social";
import { t, locale } from "@/i18n";

const pp = t.people;

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Study group — UniMate" },
      { name: "description", content: "Members, sessions and chat of a UniMate study group." },
      { property: "og:title", content: "Study group — UniMate" },
      { property: "og:description", content: "Members, sessions and chat of a UniMate study group." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const qc = useQueryClient();
  const [propose, setPropose] = useState(false);
  const { data: me } = useQuery(meSocialQuery);
  const { data: g } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const [grp, sessions] = await Promise.all([
        supabase
          .from("study_groups")
          .select("*, courses(name), course_topics(name), group_members(user_id, profiles(full_name, is_demo))")
          .eq("id", groupId)
          .maybeSingle(),
        supabase
          .from("group_sessions")
          .select("*, venues(name), group_session_participants(user_id, status)")
          .eq("group_id", groupId)
          .order("starts_at"),
      ]);
      return grp.data ? { ...grp.data, sessions: sessions.data ?? [] } : null;
    },
  });
  if (!g) return <AppShell><div className="h-40 animate-pulse rounded-3xl bg-muted" /></AppShell>;

  const member = g.group_members.some((m) => m.user_id === me?.uid);
  const organizer = g.group_members.find((m) => m.user_id === g.organizer_id)?.profiles?.full_name?.split(" ")[0];

  async function leave() {
    await supabase.rpc("leave_group", { _group: groupId });
    toast.success(pp.left);
    qc.invalidateQueries({ queryKey: ["groups"] });
    qc.invalidateQueries({ queryKey: ["group", groupId] });
  }
  async function joinSession(id: string) {
    const { error } = await supabase.rpc("respond_session", { _session: id, _accept: true });
    if (error) return toast.error(error.message);
    toast.success(pp.propose.done);
    qc.invalidateQueries({ queryKey: ["group", groupId] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <AppShell>
      <Link to="/persone" search={{ tab: "groups" }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {pp.backPeople}
      </Link>
      <div className="mt-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
          {[g.courses?.name, g.course_topics?.name].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">{g.name}</h1>
        <p className="mt-2 text-muted-foreground">{g.description}</p>
        <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {pp.members(g.group_members.length)}</span>
          {organizer && <span>{pp.organizer}: {organizer}</span>}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {g.group_members.map((m) => (
            <span key={m.user_id} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs">
              {m.user_id === me?.uid ? me.firstName || "You" : (m.profiles?.full_name?.split(" ")[0] ?? "Student")}
              {m.profiles?.is_demo && <DemoBadge />}
            </span>
          ))}
        </div>
        <div className="mt-5 flex gap-2">
          {member ? (
            <>
              <Button onClick={() => setPropose(true)}><CalendarPlus className="h-4 w-4" /> {pp.propose.title}</Button>
              <Button variant="outline" onClick={leave}>{pp.leave}</Button>
            </>
          ) : (
            <Button onClick={() => joinGroup(qc, groupId)}>{pp.join}</Button>
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">{pp.sessions}</h2>
        {g.sessions.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{pp.noSessions}</p>}
        <ul className="mt-3 space-y-2">
          {g.sessions.map((s) => {
            const going = s.group_session_participants.some((x) => x.user_id === me?.uid && x.status === "accepted");
            const count = s.group_session_participants.filter((x) => x.status === "accepted").length;
            const state = sessionState(s.starts_at, s.ends_at);
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{s.title} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">{pp.sessionState[state]}</span></p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(s.starts_at).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    <MapPin className="inline h-3.5 w-3.5" /> {s.online ? pp.propose.online : s.venues?.name} · {count}/{s.max_participants}
                  </p>
                </div>
                {going ? (
                  <span className="text-sm font-semibold text-secondary">{pp.going}</span>
                ) : state !== "done" && member ? (
                  <Button size="sm" variant="secondary" onClick={() => joinSession(s.id)}>{pp.joinSession}</Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {member && g.chat_id && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">{pp.groupChat}</h2>
          <ChatThread chatId={g.chat_id} showNames />
        </section>
      )}
      <ProposeSessionDialog open={propose} onOpenChange={setPropose} groupId={groupId} courseId={g.course_id} />
    </AppShell>
  );
}
