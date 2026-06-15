import { LoginForm } from "@/app/login/login-form";

function sanitizeNextPath(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);

  return <LoginForm nextPath={nextPath} />;
}
