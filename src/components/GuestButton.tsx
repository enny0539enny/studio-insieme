import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startGuestSession } from "@/lib/guest";
import { t } from "@/i18n";

export function GuestButton() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  return (
    <div>
      <Button
        size="lg"
        className="h-14 w-full text-base shadow-soft"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await startGuestSession();
            navigate({ to: "/onboarding" });
          } catch {
            toast.error(t.guest.error);
            setLoading(false);
          }
        }}
      >
        <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        {t.guest.try}
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">{t.guest.tryHint}</p>
    </div>
  );
}
