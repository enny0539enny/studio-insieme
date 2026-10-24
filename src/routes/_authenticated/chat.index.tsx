import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { supabase } from "@/integrations/supabase/client";
import { t, locale } from "@/i18n";

export type ChatRow = {
  chat_id: string;
  other_id: string;
  other_first_name: string;
  other_is_demo: boolean;
  other_archetype: string | null;
  other_social: number | null;
  pinned: { subject?: string; venue?: string | null; activity?: string; ends_at?: string };
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
      { name: "description", content: "Your study chats on UniMate." },
      { property: "og:title", content: "Chat — UniMate" },
      { property: "og:description", content: "Your study chats on UniMate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatList,
});

function ChatList() {
  const { data: chats = [] } = useQuery({ ...chatsQuery, refetchInterval: 8000 });
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold md:text-4xl">{t.chats.title}</h1>
      {chats.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-16 text-center shadow-soft">
          <MessageCircle className="h-8 w-8 text-secondary" strokeWidth={1.5} />
          <p className="mt-4 max-w-sm text-muted-foreground">{t.chats.empty}</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {chats.map((c) => (
            <li key={c.chat_id}>
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
          ))}
        </ul>
      )}
    </AppShell>
  );
}
