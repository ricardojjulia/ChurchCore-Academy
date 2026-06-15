"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, KeyRound, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface LoginFormProps {
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message || "Unable to sign in. Check your credentials and try again.");
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[linear-gradient(130deg,#edf2f8_0%,#d6e0ea_45%,#c4d0de_100%)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(255,255,255,0.24)_0px,rgba(255,255,255,0.24)_1px,rgba(255,255,255,0)_1px,rgba(255,255,255,0)_12px)] opacity-45" />
        <div className="absolute left-[-10rem] top-[-8rem] h-80 w-80 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute bottom-[-9rem] right-[-8rem] h-96 w-96 rounded-full bg-slate-100/55 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="w-full rounded-3xl border-slate-300/70 bg-[linear-gradient(160deg,rgba(252,253,255,0.96)_0%,rgba(233,239,247,0.94)_100%)] shadow-[0_34px_90px_-26px_rgba(15,23,42,0.35)] backdrop-blur">
          <CardHeader className="space-y-4 pb-4 text-center">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-slate-100/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
              <Sparkles className="h-3.5 w-3.5" />
              ChurchCore Academy
            </p>

            <CardTitle className="text-3xl font-bold leading-tight text-slate-900 sm:text-[2.05rem]">
              Welcome back
            </CardTitle>

            <CardDescription className="mx-auto max-w-md text-sm text-slate-600 sm:text-base">
              Sign in to access your Academy workspace and continue serving students with clarity and care.
            </CardDescription>

            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-300/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600">
              <Shield className="h-3.5 w-3.5" />
              Secure tenant-aware access
            </p>
          </CardHeader>

          <CardContent>
            <form className="grid gap-5" onSubmit={onSubmit}>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Email
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  className="h-11 border-slate-300/80 bg-white/85"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Password
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  className="h-11 border-slate-300/80 bg-white/85"
                />
              </label>

              {error ? (
                <p className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </p>
              ) : null}

              <div className="grid gap-3 pt-1">
                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  className="h-11 border border-slate-400/60 bg-[linear-gradient(165deg,#7c8797_0%,#5b6471_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                >
                  <KeyRound />
                  Log in
                </Button>
                <Button
                  size="default"
                  variant="outline"
                  render={<Link href="/" />}
                  className="h-10 border-slate-400/70 bg-white/60 text-slate-700"
                >
                  Back to Dashboard
                  <ArrowRight />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
