import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { MatchesStrip } from "@/components/people/MatchesStrip";
import { groupsQuery } from "@/components/people/GroupsTab";
import { supabase } from "@/integrations/supabase/client";
import { matchesQuery, meSocialQuery } from "@/lib/social";
import { t, locale } from "@/i18n";

export type ChatRow = {
  chat_id: string;
  other_id: string;
  other_first_name: string;
  other_is_demo: boolean;
  other_archetype: string | null;
  other_social: number | null;
  pinned: { subject?: string; venue?: string | null; activity?: string; ends_at?: string; match?: boolean; course?: string };
  last_body: string | null;
  last_at: string;
};

export const chatsQuery = {
  queryKey: ["chats"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_chats");
    if (error) throw error;
    return (data ?? []) as unknown as ChatRow[];
  },
};

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({
    meta: [
      { title: "Chat — UniMate" },
      { name: "description", content: "Your study chats, matches and groups on UniMate." },
      { property: "og:title", content: "Chat — UniMate" },
      { property: "og:description", content: "Your study chats, matches and groups on UniMate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatList,
});

function ChatItem({ c }: { c: ChatRow }) {
  return (
    <li>
      <Link to="/chat/$chatId" params={{ chatId: c.chat_id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40">
        <ArchetypeAvatar archetype={c.other_archetype} social={c.other_social ?? undefined} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">{c.other_first_name} {c.other_is_demo && <DemoBadge />}</p>
          <p className="truncate text-sm text-muted-foreground">{c.last_body}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(c.last_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
        </span>
      </Link>
    </li>
  );
}

function ChatList() {
  const { data: chats = [] } = useQuery({ ...chatsQuery, refetchInterval: 8000 });
  const { data: matches = [] } = useQuery(matchesQuery);
  const { data: me } = useQuery(meSocialQuery);
  const { data: groups = [] } = useQuery(groupsQuery);
  const matchChats = new Set(matches.map((m) => m.chat_id));
  const matchList = chats.filter((c) => matchChats.has(c.chat_id));
  const requests = chats.filter((c) => !matchChats.has(c.chat_id));
  const myGroups = groups.filter((g) => g.group_members.some((m) => m.user_id === me?.uid));

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold md:text-4xl">{t.chats.title}</h1>
      <div className="mt-6">
        <MatchesStrip />
      </div>
      {matchList.length > 0 && <ul className="mt-6 flex flex-col gap-2">{matchList.map((c) => <ChatItem key={c.chat_id} c={c} />)}</ul>}

      {myGroups.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.people.myGroups}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {myGroups.map((g) => (
              <li key={g.id}>
                <Link to="/groups/$groupId" params={{ groupId: g.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/15 text-secondary"><Users className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="font-semibold">{g.name}</p>
                    <p className="text-sm text-muted-foreground">{t.people.members(g.group_members.length)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.people.requests}</h2>
        {requests.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <MessageCircle className="h-5 w-5 text-secondary" strokeWidth={1.5} /> {t.people.noRequests}
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">{requests.map((c) => <ChatItem key={c.chat_id} c={c} />)}</ul>
        )}
      </section>
    </AppShell>
  );
}
