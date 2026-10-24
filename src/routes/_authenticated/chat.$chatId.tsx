import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, MapPin, Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { t, locale } from "@/i18n";
import { cn } from "@/lib/utils";
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
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const { data: chats = [] } = useQuery(chatsQuery);
  const chat = chats.find((c) => c.chat_id === chatId);
  const { data: msgs = [] } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const [{ data: u }, { data }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("chat_messages").select("id, sender_id, body, created_at").eq("chat_id", chatId).order("created_at"),
      ]);
      return (data ?? []).map((x) => ({ ...x, mine: x.sender_id === u.user?.id }));
    },
    refetchInterval: 4000,
  });
  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim().slice(0, 2000);
    if (!body) return;
    const { data: u } = await supabase.auth.getUser();
    setText("");
    await supabase.from("chat_messages").insert({ chat_id: chatId, sender_id: u.user!.id, body });
    qc.invalidateQueries({ queryKey: ["chat", chatId] });
    qc.invalidateQueries({ queryKey: ["chats"] });
  }

  const p = chat?.pinned;
  return (
    <AppShell>
      <Link to="/chat" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t.chats.back}
      </Link>
      {chat && (
        <div className="mt-4 flex items-center gap-3">
          <ArchetypeAvatar archetype={chat.other_archetype} social={chat.other_social ?? undefined} className="h-12 w-12" />
          <p className="flex items-center gap-2 text-xl font-semibold">{chat.other_first_name} {chat.other_is_demo && <DemoBadge />}</p>
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
      <div className="mt-4 flex flex-col gap-2">
        {msgs.map((x) => (
          <div key={x.id} className={cn("max-w-[80%] rounded-2xl px-4 py-2 text-sm", x.mine ? "self-end bg-primary text-primary-foreground" : "self-start bg-card border border-border")}>
            {x.body}
            <span className={cn("ml-2 text-[10px]", x.mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{time(x.created_at)}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="sticky bottom-24 mt-4 flex gap-2 md:bottom-4">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.chats.placeholder} maxLength={2000} className="bg-card" />
        <Button type="submit" aria-label={t.chats.send}><Send className="h-4 w-4" /></Button>
      </form>
    </AppShell>
  );
}
