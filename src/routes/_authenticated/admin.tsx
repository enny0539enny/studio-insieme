import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { t, locale } from "@/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: u.user!.id, _role: "admin" });
    if (!isAdmin) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "Admin queue — UniMate" },
      { name: "description", content: "Review reports and suggested study places." },
      { property: "og:title", content: "Admin queue — UniMate" },
      { property: "og:description", content: "Review reports and suggested study places." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-queue"],
    queryFn: async () => {
      const [r, v] = await Promise.all([
        supabase.from("reports").select("id, reported_id, reason, created_at").eq("status", "open").order("created_at", { ascending: false }),
        supabase.from("venues").select("id, name, type, lat, lng, created_at").eq("approved", false).order("created_at"),
      ]);
      return { reports: r.data ?? [], venues: v.data ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-queue"] });
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">{t.admin.title}</h1>
      <h2 className="mt-8 text-lg font-semibold">{t.admin.reports}</h2>
      {data?.reports.length === 0 && <p className="text-sm text-muted-foreground">{t.admin.none}</p>}
      {data?.reports.map((r) => (
        <div key={r.id} className="mt-2 flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="text-sm">
            <p className="font-mono text-xs text-muted-foreground">{r.reported_id}</p>
            <p className="mt-1">{r.reason}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString(locale)}</p>
          </div>
          <Button size="sm" variant="outline" onClick={async () => { await supabase.from("reports").update({ status: "resolved" }).eq("id", r.id); refresh(); }}>
            {t.admin.resolve}
          </Button>
        </div>
      ))}
      <h2 className="mt-8 text-lg font-semibold">{t.admin.venues}</h2>
      {data?.venues.length === 0 && <p className="text-sm text-muted-foreground">{t.admin.none}</p>}
      {data?.venues.map((v) => (
        <div key={v.id} className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
          <div>
            <p className="font-semibold">{v.name}</p>
            <p className="text-xs text-muted-foreground">{t.map.venueTypes[v.type]} · {v.lat.toFixed(5)}, {v.lng.toFixed(5)}</p>
          </div>
          <Button size="sm" onClick={async () => { await supabase.from("venues").update({ approved: true }).eq("id", v.id); refresh(); }}>
            {t.admin.approve}
          </Button>
        </div>
      ))}
    </AppShell>
  );
}
