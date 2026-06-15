import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { resolvePlatformSessionForServerComponent } from "@/modules/academy-auth/request-context";

export interface UserSession {
  id: string;
  email: string | null;
  role?: string | null;
  tenantId?: string | null;
  platformRoles?: string[];
}

const ACTIVE_TENANT_COOKIE = "academy_active_tenant";

interface SessionUserRecord {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

interface PlatformSessionLike {
  platformRoles: string[];
  activeTenant: {
    tenantId: string;
    roles: string[];
  };
}

export function buildUserSession(
  user: SessionUserRecord,
  platformSession?: PlatformSessionLike | null,
): UserSession {
  const activeTenantRole = platformSession?.activeTenant.roles[0] ?? null;
  const metadataRole = (user.user_metadata?.role as string) || null;
  const metadataTenantId = (user.user_metadata?.tenant_id as string) || null;

  return {
    id: user.id,
    email: user.email || null,
    role: activeTenantRole ?? metadataRole,
    tenantId: platformSession?.activeTenant.tenantId ?? metadataTenantId,
    platformRoles: platformSession?.platformRoles ?? [],
  };
}

export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const cookieStore = await cookies();
    const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

    let platformSession: PlatformSessionLike | null = null;
    try {
      platformSession = await resolvePlatformSessionForServerComponent({
        preferredTenantId,
      });
    } catch {
      platformSession = null;
    }

    return buildUserSession(user, platformSession);
  } catch {
    return null;
  }
}
