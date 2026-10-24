import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Flame, Megaphone, Sparkles, Users, UserCheck, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dashboard } from "@/lib/dashboard";
import { t } from "@/i18n";

const d = t.dash;

export function ProgressSection({ data }: { data: Dashboard }) {
  const stats = [
    { icon: Clock, label: d.thisWeek, value: `${data.weekHours} h` },
    { icon: Flame, label: d.streak, value: d.days(data.streak) },
    { icon: Sparkles, label: d.aura, value: String(data.aura) },
    ...(data.attendanceRate != null ? [{ icon: UserCheck, label: d.attendance, value: `${data.attendanceRate}%` }] : []),
  ];
  return (
    <section>
      <h2 className="font-display text-lg font-semibold">{d.progress}</h2>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-3">
            <s.icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <p className="mt-2 text-lg font-semibold leading-none">{s.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ForYouSection({ data }: { data: Dashboard }) {
  const ann = data.announcements[0];
  const peer = data.peers[0];
  const cards = [];
  if (data.matchCount > 0)
    cards.push(
      <Card key="m" icon={Heart} title={d.matches(data.matchCount)}>
        <Link to="/persone" className="text-xs font-semibold text-primary hover:underline">
          {d.seeMatches}
        </Link>
      </Card>,
    );
  if (peer)
    cards.push(
      <Card key="p" icon={Users} title={d.peers(peer.peers, peer.topic_name)}>
        <Button asChild size="sm" variant="secondary" className="h-7 text-xs">
          <Link to="/persone">{d.createGroup}</Link>
        </Button>
      </Card>,
    );
  if (ann) {
    const course = data.courses.find((c) => c.id === ann.course_id);
    cards.push(
      <Card key="a" icon={Megaphone} title={ann.title} eyebrow={`${d.announcement} · ${course?.name ?? ""}`}>
        <p className="line-clamp-2 text-xs text-muted-foreground">{ann.body}</p>
      </Card>,
    );
  }
  if (cards.length === 0) return null;
  return (
    <section>
      <h2 className="font-display text-lg font-semibold">{d.forYou}</h2>
      <div className="-mx-5 mt-3 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">{cards}</div>
    </section>
  );
}

function Card({ icon: Icon, title, eyebrow, children }: { icon: typeof Heart; title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <div className="flex w-64 shrink-0 snap-start flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <Icon className="h-5 w-5 text-secondary" strokeWidth={1.75} />
      {eyebrow && <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>}
      <p className="text-sm font-semibold leading-snug">{title}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}
