import { createFileRoute } from "@tanstack/react-router";
import { Map } from "lucide-react";
import { PlaceholderPage } from "@/components/AppShell";
import { t } from "@/i18n/it";

export const Route = createFileRoute("/_authenticated/mappa")({
  head: () => ({ meta: [{ title: `${t.nav.mappa} — StudySync` }] }),
  component: () => <PlaceholderPage title={t.nav.mappa} text={t.placeholder.mappa} icon={Map} />,
});
