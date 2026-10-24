import { t } from "@/i18n";

/** Small label shown next to every demo person so they are never mistaken for real users. */
export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/40 bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {t.demo}
    </span>
  );
}
