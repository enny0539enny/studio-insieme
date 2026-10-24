import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { sendChatMessage } from "@/lib/social";
import { t, locale } from "@/i18n";
import { cn } from "@/lib/utils";

const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

/** Message list + composer. `showNames` labels other senders (group chats). */
export function ChatThread({ chatId, showNames = false }: { chatId: string; showNames?: boolean }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const { data: msgs = [] } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const [{ data: u }, { data }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("chat_messages")
          .select("id, sender_id, body, created_at, profiles(full_name)")
          .eq("chat_id", chatId)
          .order("created_at"),
      ]);
      return (data ?? []).map((x) => ({
        ...x,
        mine: x.sender_id === u.user?.id,
        name: (x.profiles?.full_name ?? "").split(" ")[0] ?? "",
      }));
    },
    refetchInterval: 4000,
  });
  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim().slice(0, 2000);
    if (!body) return;
    setText("");
    try {
      await sendChatMessage(qc, chatId, body);
    } catch {
      toast.error(t.auth.genericError);
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-col gap-2" data-testid="chat-messages">
        {msgs.map((x) => (
          <div
            key={x.id}
            className={cn(
              "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
              x.mine ? "self-end bg-primary text-primary-foreground" : "self-start border border-border bg-card",
            )}
          >
            {showNames && !x.mine && x.name && <p className="text-[11px] font-semibold text-secondary">{x.name}</p>}
            {x.body}
            <span className={cn("ml-2 text-[10px]", x.mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{time(x.created_at)}</span>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="sticky bottom-24 mt-4 flex gap-2 md:bottom-4">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.chats.placeholder} maxLength={2000} className="bg-card" />
        <Button type="submit" aria-label={t.chats.send}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}
