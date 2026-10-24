import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/AppShell";
import { t } from "@/i18n/it";

export const Route = createFileRoute("/_authenticated/persone")({
  head: () => ({ meta: [{ title: `${t.nav.persone} — StudySync` }] }),
  component: () => <PlaceholderPage title={t.nav.persone} text={t.placeholder.persone} icon={Users} />,
});
