import { createClient } from "@/lib/supabase/server";

export interface UserSession {
  id: string;
  email: string | null;
  role?: string | null;
  tenantId?: string | null;
}

export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || null,
      role: (user.user_metadata?.role as string) || null,
      tenantId: (user.user_metadata?.tenant_id as string) || null,
    };
  } catch {
    return null;
  }
}
