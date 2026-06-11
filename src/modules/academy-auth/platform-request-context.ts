import { createClient } from "@/lib/supabase/server";

const allowedPlatformRoles = new Set(["platform_staff", "platform_admin"]);

function parseRoleList(value: string | null) {
  if (!value) return [];

  return value
    .split(",")
    .map((role) => role.trim())
    .filter((role) => allowedPlatformRoles.has(role));
}

function uniqueRoles(roles: string[]) {
  return [...new Set(roles)];
}

export async function resolvePlatformRoles(headers: Headers) {
  const headerRoles = [headers.get("x-platform-roles"), headers.get("x-platform-role")]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => parseRoleList(value));

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return uniqueRoles(headerRoles);
    }

    const appMetadataRole = typeof data.user.app_metadata?.role === "string" ? data.user.app_metadata.role : null;
    const userMetadataRole = typeof data.user.user_metadata?.role === "string" ? data.user.user_metadata.role : null;

    return uniqueRoles([
      ...headerRoles,
      ...parseRoleList(appMetadataRole),
      ...parseRoleList(userMetadataRole),
    ]);
  } catch {
    return uniqueRoles(headerRoles);
  }
}
