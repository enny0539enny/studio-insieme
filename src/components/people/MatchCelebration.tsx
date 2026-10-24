import { motion } from "framer-motion";
import { MessageCircle, CalendarPlus } from "lucide-react";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { DemoBadge } from "@/components/DemoBadge";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import type { MatchResult } from "./SwipeDeck";

const c = t.people.celebration;

export function MatchCelebration({
  match,
  me,
  onMessage,
  onPropose,
  onClose,
}: {
  match: MatchResult;
  me: { archetype: string | null; social: number };
  onMessage: () => void;
  onPropose: () => void;
  onClose: () => void;
}) {
  const o = match.other;
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 text-center backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }, (_, i) => (
          <motion.span
            key={i}
            className={i % 2 ? "absolute h-3 w-3 rounded-full bg-primary/40" : "absolute h-2 w-2 rounded-full bg-secondary/50"}
            style={{ left: `${(i * 37) % 100}%`, top: "60%" }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -320 - (i % 4) * 60, opacity: [0, 1, 0] }}
            transition={{ duration: 2.4, delay: i * 0.08, ease: "easeOut" }}
          />
        ))}
      </div>
      <div className="relative flex items-center">
        <motion.div initial={{ x: -60, scale: 0.4, opacity: 0 }} animate={{ x: 12, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}>
          <ArchetypeAvatar archetype={me.archetype} social={me.social} className="h-32 w-32 rounded-full ring-4 ring-background" />
        </motion.div>
        <motion.div initial={{ x: 60, scale: 0.4, opacity: 0 }} animate={{ x: -12, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.1 }}>
          <ArchetypeAvatar archetype={o.archetype} social={o.candidate.likert.social} className="h-32 w-32 rounded-full ring-4 ring-background" />
        </motion.div>
      </div>
      <motion.h2
        className="mt-8 font-display text-4xl font-semibold text-primary md:text-5xl"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        {c.title}
      </motion.h2>
      <p className="mt-3 flex items-center gap-2 text-muted-foreground">
        {c.subtitle(o.first_name)} {o.is_demo && <DemoBadge />}
      </p>
      {match.course && (
        <span className="mt-4 rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">{c.course(match.course)}</span>
      )}
      <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" onClick={onMessage}>
          <MessageCircle className="h-4 w-4" /> {c.message}
        </Button>
        <Button size="lg" variant="secondary" onClick={onPropose}>
          <CalendarPlus className="h-4 w-4" /> {c.propose}
        </Button>
        <button type="button" onClick={onClose} className="mt-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          {c.keep}
        </button>
      </div>
    </motion.div>
  );
}
