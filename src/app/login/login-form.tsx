"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { AlertCircle, ArrowRight, GraduationCap, KeyRound, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    let supabase;
    try {
      supabase = createClient();
    } catch (clientError) {
      setError(clientError instanceof Error ? clientError.message : "Authentication is not configured.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message || "Unable to sign in. Check your credentials and try again.");
      setLoading(false);
      return;
    }

    // Full navigation, not router.push: in production builds the "Back to Dashboard" <Link href="/">
    // prefetches "/" while signed out, and the client router reuses that cached redirect-to-login
    // after sign-in, bouncing a successfully authenticated user back to /login. A document
    // navigation always sends the fresh session cookie to the server.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate full navigation, see above
    window.location.assign("/");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(145,132,217,0.22),transparent_34%),radial-gradient(circle_at_86%_84%,rgba(145,132,217,0.16),transparent_38%),linear-gradient(145deg,#161826_0%,#1b1d2c_54%,#20233a_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-35 [background-image:repeating-linear-gradient(115deg,rgba(233,233,237,0.06)_0,rgba(233,233,237,0.06)_1px,transparent_1px,transparent_14px)]"
      />

      <section className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-border bg-card p-8 shadow-[0_34px_90px_-30px_rgba(0,0,0,0.72)] backdrop-blur">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent bg-transparent text-accent">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--color-accent-300)]">ChurchCore Academy</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground">Welcome back</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            Sign in to access your Academy workspace and continue serving students with clarity and care.
          </p>
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-[var(--color-accent-300)]">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            Secure tenant-aware access
          </div>
        </div>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-foreground/70">
            Email
            <Input
              className="h-12 rounded-xl text-base"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground/70">
            Password
            <Input
              className="h-12 rounded-xl text-base"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>

          {error ? (
            <p className="flex items-center gap-2 rounded-xl border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200">
              <AlertCircle className="h-4 w-4 flex-none" />
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 pt-2">
            <Button type="submit" size="lg" loading={loading} className="h-12 rounded-xl text-base">
              <KeyRound className="h-5 w-5" />
              Log in
            </Button>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-transparent text-sm font-semibold text-foreground transition-colors hover:bg-foreground/[0.07]"
            >
              Back to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
