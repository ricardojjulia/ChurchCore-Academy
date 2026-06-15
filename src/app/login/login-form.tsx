"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, GraduationCap, KeyRound, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
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

    router.push("/");
    router.refresh();
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#071426] px-4 py-10 text-slate-950">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(74,144,226,0.32),transparent_34%),radial-gradient(circle_at_86%_84%,rgba(25,132,148,0.28),transparent_38%),linear-gradient(145deg,#071426_0%,#102642_54%,#12334d_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-35 [background-image:repeating-linear-gradient(115deg,rgba(148,190,233,0.22)_0,rgba(148,190,233,0.22)_1px,transparent_1px,transparent_14px)]"
      />

      <section className="relative z-10 w-full max-w-md rounded-[1.75rem] border border-white/35 bg-white/95 p-8 shadow-[0_34px_90px_-30px_rgba(0,0,0,0.72)] backdrop-blur">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#123c69] text-white shadow-lg shadow-blue-950/20">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2c5d8e]">ChurchCore Academy</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-[#102f4b]">Welcome back</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-600">
            Sign in to access your Academy workspace and continue serving students with clarity and care.
          </p>
          <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#24527f]">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            Secure tenant-aware access
          </div>
        </div>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-semibold text-[#1f456d]">
            Email
            <Input
              className="h-12 rounded-xl border-slate-200 bg-white text-base shadow-inner shadow-slate-100"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#1f456d]">
            Password
            <Input
              className="h-12 rounded-xl border-slate-200 bg-white text-base shadow-inner shadow-slate-100"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>

          {error ? (
            <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              <AlertCircle className="h-4 w-4 flex-none" />
              {error}
            </p>
          ) : null}

          <div className="grid gap-3 pt-2">
            <Button type="submit" size="lg" loading={loading} className="h-12 rounded-xl bg-[#2763a6] text-base shadow-lg shadow-blue-900/20 hover:bg-[#1f548f]">
              <KeyRound className="h-5 w-5" />
              Log in
            </Button>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 text-sm font-semibold text-[#1a3d61] transition-colors hover:bg-blue-100"
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
