import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    // Students must finish onboarding before any other page.
    const { data: sp } = await supabase
      .from("student_profiles")
      .select("onboarding_completed")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (sp && !sp.onboarding_completed && location.pathname !== "/onboarding") {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: () => <Outlet />,
});
