import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { supabase } from "@/integrations/supabase/client";
import { pingsQuery } from "@/lib/live";
import { t } from "@/i18n";

/** Incoming Ping to Join requests with Accept / Decline. */
export function PingsBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: pings = [] } = useQuery(pingsQuery);
  const incoming = pings.filter((p) => p.incoming && p.status === "pending");

  async function respond(id: string, accept: boolean) {
    const { data: chatId } = await supabase.rpc("respond_ping", { _ping_id: id, _accept: accept });
    await qc.invalidateQueries({ queryKey: ["pings"] });
    if (accept && chatId) navigate({ to: "/chat/$chatId", params: { chatId } });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label={t.pings.title} className="relative rounded-full p-2 text-muted-foreground hover:bg-muted">
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          {incoming.length > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {incoming.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <p className="mb-2 text-sm font-semibold">{t.pings.title}</p>
        {incoming.length === 0 && <p className="text-sm text-muted-foreground">{t.pings.none}</p>}
        <ul className="flex flex-col gap-3">
          {incoming.map((p) => (
            <li key={p.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <ArchetypeAvatar archetype={p.other_archetype} social={p.other_social ?? undefined} className="h-8 w-8" />
                <span className="font-semibold">{p.other_first_name}</span>
                {p.other_is_demo && <DemoBadge />}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.message}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => respond(p.id, true)}>{t.pings.accept}</Button>
                <Button size="sm" variant="outline" onClick={() => respond(p.id, false)}>{t.pings.decline}</Button>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
