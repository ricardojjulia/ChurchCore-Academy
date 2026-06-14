"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, KeyRound } from "lucide-react";
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
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Log in to ChurchCore Academy</CardTitle>
          <CardDescription>Use your Supabase account to access HQ and protected workflows.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              Email
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-foreground">
              Password
              <Input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />
            </label>

            {error ? (
              <p className="flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg" loading={loading}>
                <KeyRound />
                Log in
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/" />}>
                Back to Dashboard
                <ArrowRight />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
