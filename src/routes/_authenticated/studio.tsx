import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { PlaceholderPage } from "@/components/AppShell";
import { t } from "@/i18n/it";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({ meta: [{ title: `${t.nav.studio} — StudySync` }] }),
  component: () => <PlaceholderPage title={t.nav.studio} text={t.placeholder.studio} icon={BookOpen} />,
});
