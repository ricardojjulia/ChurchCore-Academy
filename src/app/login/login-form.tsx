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

  const shellStyle = {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "2rem 1rem",
    background:
      "linear-gradient(140deg, #edf2f8 0%, #d7e1ec 48%, #c5d1de 100%)",
  } as const;

  const frameStyle = {
    width: "100%",
    maxWidth: "32rem",
    position: "relative",
    zIndex: 1,
  } as const;

  const cardStyle = {
    borderRadius: "1.6rem",
    border: "1px solid rgba(100, 116, 139, 0.34)",
    background:
      "linear-gradient(165deg, rgba(252,253,255,0.97), rgba(233,239,247,0.94))",
    boxShadow:
      "0 34px 90px -26px rgba(15,23,42,0.35), inset 0 1px 0 rgba(255,255,255,0.7)",
  } as const;

  const backLinkStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    minHeight: "2.6rem",
    borderRadius: "0.75rem",
    border: "1px solid rgba(100,116,139,0.45)",
    background: "rgba(255,255,255,0.7)",
    color: "#334155",
    fontSize: "0.9rem",
    fontWeight: 600,
    textDecoration: "none",
  } as const;

  return (
    <main style={shellStyle}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 1px, rgba(255,255,255,0) 1px, rgba(255,255,255,0) 12px)",
          opacity: 0.45,
        }}
      />

      <div style={frameStyle}>
        <Card style={cardStyle}>
          <CardHeader style={{ textAlign: "center", paddingBottom: "0.4rem" }}>
            <p
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                margin: "0 auto",
                borderRadius: "999px",
                border: "1px solid rgba(100,116,139,0.42)",
                background: "rgba(241,245,249,0.88)",
                padding: "0.25rem 0.7rem",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#334155",
              }}
            >
              <Sparkles size={14} />
              ChurchCore Academy
            </p>

            <CardTitle style={{ marginTop: "0.9rem", fontSize: "2rem", lineHeight: 1.1, color: "#0f172a" }}>
              Welcome back
            </CardTitle>

            <CardDescription style={{ marginTop: "0.45rem", maxWidth: "26rem", marginInline: "auto", color: "#5b6b7f" }}>
              Sign in to access your Academy workspace and continue serving students with clarity and care.
            </CardDescription>

            <p
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                margin: "0.9rem auto 0",
                borderRadius: "999px",
                border: "1px solid rgba(100,116,139,0.36)",
                background: "rgba(255,255,255,0.76)",
                padding: "0.3rem 0.8rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#465a71",
              }}
            >
              <Shield size={14} />
              Secure tenant-aware access
            </p>
          </CardHeader>

          <CardContent>
            <form style={{ display: "grid", gap: "1.1rem" }} onSubmit={onSubmit}>
              <label style={{ display: "grid", gap: "0.45rem", fontSize: "0.95rem", fontWeight: 600, color: "#334155" }}>
                Email
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  style={{ height: "2.9rem" }}
                />
              </label>
              <label style={{ display: "grid", gap: "0.45rem", fontSize: "0.95rem", fontWeight: 600, color: "#334155" }}>
                Password
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  style={{ height: "2.9rem" }}
                />
              </label>

              {error ? (
                <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderRadius: "0.6rem", border: "1px solid #efb8b8", background: "#fdf0f0", padding: "0.6rem 0.75rem", fontSize: "0.9rem", color: "#8a2b2b" }}>
                  <AlertCircle size={16} />
                  {error}
                </p>
              ) : null}

              <div style={{ display: "grid", gap: "0.7rem", paddingTop: "0.3rem" }}>
                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  style={{
                    height: "2.9rem",
                    border: "1px solid rgba(95,108,126,0.65)",
                    background: "linear-gradient(165deg, #7c8797 0%, #5b6471 100%)",
                    color: "#fff",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                    fontWeight: 700,
                  }}
                >
                  <KeyRound />
                  Log in
                </Button>
                <Link href="/" style={backLinkStyle}>
                  Back to Dashboard
                  <ArrowRight />
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
