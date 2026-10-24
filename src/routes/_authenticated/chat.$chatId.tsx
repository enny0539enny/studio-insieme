import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Clock, MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/ChatThread";
import { ProposeSessionDialog } from "@/components/people/ProposeSessionDialog";
import { t, locale } from "@/i18n";
import { chatsQuery } from "./chat.index";

export const Route = createFileRoute("/_authenticated/chat/$chatId")({
  head: () => ({
    meta: [
      { title: "Study chat — UniMate" },
      { name: "description", content: "Chat about your shared study session." },
      { property: "og:title", content: "Study chat — UniMate" },
      { property: "og:description", content: "Chat about your shared study session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

function ChatPage() {
  const { chatId } = Route.useParams();
  const [propose, setPropose] = useState(false);
  const { data: chats = [] } = useQuery(chatsQuery);
  const chat = chats.find((c) => c.chat_id === chatId);
  const p = chat?.pinned as (typeof chat extends undefined ? never : NonNullable<typeof chat>["pinned"]) & { match?: boolean; course?: string };

  return (
    <AppShell>
      <Link to="/chat" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t.chats.back}
      </Link>
      {chat && (
        <div className="mt-4 flex items-center gap-3">
          <ArchetypeAvatar archetype={chat.other_archetype} social={chat.other_social ?? undefined} className="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-xl font-semibold">
              {chat.other_first_name} {chat.other_is_demo && <DemoBadge />}
            </p>
            {p?.course && <p className="text-xs font-medium text-primary">{t.people.celebration.course(p.course)}</p>}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPropose(true)}>
            <CalendarPlus className="h-4 w-4" /> <span className="hidden sm:inline">{t.people.propose.title}</span>
          </Button>
        </div>
      )}
      {p?.subject && (
        <div className="sticky top-2 z-10 mt-4 rounded-2xl border border-secondary/30 bg-secondary/10 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{t.chats.session}</p>
          <p className="mt-1 font-semibold">{p.subject} · {t.map.activities[p.activity ?? ""] ?? ""}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-4 text-muted-foreground">
            {p.venue && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.venue}</span>}
            {p.ends_at && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t.map.until(time(p.ends_at))}</span>}
          </p>
        </div>
      )}
      <ChatThread chatId={chatId} />
      <ProposeSessionDialog open={propose} onOpenChange={setPropose} chatId={chatId} inviteeId={chat?.other_id} />
    </AppShell>
  );
}
