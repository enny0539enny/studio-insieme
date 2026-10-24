import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArchetypeAvatar } from "@/components/ArchetypeAvatar";
import { matchesQuery } from "@/lib/social";
import { t } from "@/i18n";

/** Avatars of all mutual matches; tapping one opens the chat. */
export function MatchesStrip() {
  const { data: matches = [] } = useQuery(matchesQuery);
  return (
    <section aria-label={t.people.matches}>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t.people.matches} {matches.length > 0 && `· ${matches.length}`}
      </h2>
      {matches.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t.people.noMatches}</p>
      ) : (
        <div className="-mx-5 mt-3 flex gap-4 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
          {matches.map((m) =>
            m.chat_id ? (
              <Link
                key={m.match_id}
                to="/chat/$chatId"
                params={{ chatId: m.chat_id }}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                aria-label={m.first_name}
              >
                <ArchetypeAvatar archetype={m.archetype} social={m.social ?? undefined} className="h-14 w-14 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background" />
                <span className="w-full truncate text-center text-xs font-medium">{m.first_name}</span>
              </Link>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}
