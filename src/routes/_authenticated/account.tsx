import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Your account — UniMate" }] }),
  component: AccountPage,
});

/** Turns a guest session into a real account, keeping the same user and all data. */
function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const domain = email.trim().toLowerCase().split("@")[1] ?? "";
      const { data: domains } = await supabase.from("university_email_domains").select("domain");
      const allowed = (domains ?? []).map((d) => d.domain);
      if (!allowed.includes(domain)) {
        setError(`${t.auth.domainNotAllowed} ${allowed.map((d) => "@" + d).join(", ")}`);
        return;
      }
      const { error } = await supabase.auth.updateUser({ email: email.trim(), password });
      if (error) throw error;
      toast.success(t.account.done);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/home" });
    } catch {
      setError(t.auth.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-md">
        <h1 className="font-display text-3xl font-semibold">{t.account.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.account.subtitle}</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="acc-email">{t.auth.email}</Label>
            <Input id="acc-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-pass">{t.auth.password}</Label>
            <Input id="acc-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {t.account.submit}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
