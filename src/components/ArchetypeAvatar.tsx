import { avatarTone, type ArchetypeKey } from "@/lib/archetype";
import { cn } from "@/lib/utils";

const toneClass = { warm: "fill-avatar-warm", cool: "fill-avatar-cool", sand: "fill-avatar-sand" } as const;

function Glyph({ k }: { k: ArchetypeKey | null }) {
  const s = { className: "stroke-avatar-ink", strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const fill = "fill-avatar-paper";
  switch (k) {
    case "lighthouse":
      return (
        <g {...s}>
          <path d="M28 30 L14 24 M72 30 L86 24" fill="none" />
          <path d="M40 34 L50 24 L60 34 Z" className={cn(fill, s.className)} />
          <rect x="42" y="34" width="16" height="10" className={cn("fill-avatar-glow", s.className)} />
          <path d="M42 80 L45 44 H55 L58 80 Z" className={cn(fill, s.className)} />
          <path d="M44 58 H56 M43 70 H57" fill="none" />
        </g>
      );
    case "spark":
      return <path d="M55 18 L33 54 H48 L43 82 L68 44 H53 Z" {...s} className={cn("fill-avatar-glow", s.className)} />;
    case "cartographer":
      return (
        <g {...s}>
          <path d="M22 32 L40 26 L60 32 L78 26 V70 L60 76 L40 70 L22 76 Z" className={cn(fill, s.className)} />
          <path d="M40 26 V70 M60 32 V76" fill="none" />
          <path d="M28 58 Q38 46 48 54 T70 44" fill="none" strokeDasharray="3 4" />
        </g>
      );
    case "explorer":
      return (
        <g {...s}>
          <circle cx="50" cy="50" r="26" className={cn(fill, s.className)} />
          <path d="M50 30 L57 50 L50 70 L43 50 Z" className={cn("fill-avatar-glow", s.className)} />
          <circle cx="50" cy="50" r="2.5" className="fill-avatar-ink" />
        </g>
      );
    case "seismograph":
      return <path d="M18 52 H32 L38 34 L46 68 L54 26 L62 62 L68 46 H82" fill="none" {...s} />;
    case "metronome":
      return (
        <g {...s}>
          <path d="M36 78 L43 24 H57 L64 78 Z" className={cn(fill, s.className)} />
          <path d="M50 70 L60 34" fill="none" />
          <circle cx="57" cy="44" r="4" className={cn("fill-avatar-glow", s.className)} />
        </g>
      );
    case "sparring":
      return (
        <g {...s}>
          <path d="M32 48 C30 32 44 24 58 26 C72 28 74 44 70 56 L66 62 H40 C35 58 32 54 32 48 Z" className={cn(fill, s.className)} />
          <path d="M46 40 C52 38 58 40 60 46" fill="none" />
          <rect x="40" y="62" width="26" height="14" rx="4" className={cn("fill-avatar-glow", s.className)} />
        </g>
      );
    case "lantern":
      return (
        <g {...s}>
          <path d="M42 26 Q50 14 58 26" fill="none" />
          <rect x="40" y="26" width="20" height="8" rx="2" className={cn(fill, s.className)} />
          <rect x="36" y="34" width="28" height="36" rx="8" className={cn(fill, s.className)} />
          <path d="M50 62 C44 56 46 50 50 44 C54 50 56 56 50 62 Z" className={cn("fill-avatar-glow", s.className)} />
          <rect x="40" y="70" width="20" height="6" rx="2" className={cn(fill, s.className)} />
        </g>
      );
    default:
      return <circle cx="50" cy="44" r="12" className={cn(fill, s.className)} {...s} />;
  }
}

/** The student's picture everywhere in the app: archetype object in a circle tinted by the social axis. */
export function ArchetypeAvatar({
  archetype,
  social,
  className,
  label,
}: {
  archetype: ArchetypeKey | string | null | undefined;
  social: number | undefined;
  className?: string;
  label?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className={cn("h-12 w-12 shrink-0", className)} role="img" aria-label={label}>
      <circle cx="50" cy="50" r="50" className={toneClass[avatarTone(social)]} />
      <Glyph k={(archetype as ArchetypeKey) ?? null} />
    </svg>
  );
}
