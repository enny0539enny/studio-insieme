import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";
import { GuestButton } from "@/components/GuestButton";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — UniMate" },
      { name: "description", content: "Sign in to UniMate with your university email." },
      { property: "og:title", content: "Sign in — UniMate" },
      { property: "og:description", content: "Sign in to UniMate with your university email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      // Any email works: sign in, or create the account on the spot if it doesn't exist yet.
      let { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const up = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/onboarding`, data: { full_name: fullName || email.split("@")[0] } },
        });
        if (up.error) {
          setError(t.auth.invalidCredentials);
          return;
        }
        if (!up.data.session) ({ error } = await supabase.auth.signInWithPassword({ email, password }));
        else error = null;
        if (error) {
          setError(t.auth.invalidCredentials);
          return;
        }
      }
      // Every sign-in starts from the onboarding.
      navigate({ to: "/onboarding" });
    } catch {
      setError(t.auth.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
        <Link to="/" className="font-display text-2xl font-semibold text-primary">
          {t.app.name}
        </Link>
        <h1 className="mt-6 font-display text-3xl font-semibold">
          {mode === "signin" ? t.auth.signInTitle : t.auth.signUpTitle}
        </h1>
        <div className="mt-6">
          <GuestButton />
        </div>
        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t.auth.or}
          <span className="h-px flex-1 bg-border" />
        </div>
        <p className="text-sm text-muted-foreground">{t.auth.subtitle}</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-5">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">{t.auth.fullName}</Label>
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {info && <p className="rounded-xl bg-secondary/10 p-3 text-sm text-secondary">{info}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {mode === "signin" ? t.auth.signIn : t.auth.signUp}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 w-full text-center text-sm font-medium text-secondary hover:underline"
        >
          {mode === "signin" ? t.auth.toSignUp : t.auth.toSignIn}
        </button>
      </div>
    </div>
  );
}
