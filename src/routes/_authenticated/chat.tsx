import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { PlaceholderPage } from "@/components/AppShell";
import { t } from "@/i18n/it";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: `${t.nav.chat} — StudySync` }] }),
  component: () => <PlaceholderPage title={t.nav.chat} text={t.placeholder.chat} icon={MessageCircle} />,
});
