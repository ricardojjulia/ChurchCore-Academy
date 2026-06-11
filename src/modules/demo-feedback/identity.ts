import { createClient } from "@/lib/supabase/server";
import { DemoFeedbackIdentity } from "@/modules/demo-feedback/types";

interface SupabaseAuthClient {
  auth: {
    getUser(): Promise<{ data: { user: { email?: string | null; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null }; error: unknown }>;
  };
}

function normalizeOptional(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function resolveDemoFeedbackIdentity(
  createServerClient: () => Promise<SupabaseAuthClient> = createClient,
): Promise<DemoFeedbackIdentity> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return { userEmail: null, userRole: null };
    }

    const user = data.user;
    const role = normalizeOptional(user.app_metadata?.role) ?? normalizeOptional(user.user_metadata?.role);

    return {
      userEmail: normalizeOptional(user.email)?.toLowerCase() ?? null,
      userRole: role,
    };
  } catch {
    return { userEmail: null, userRole: null };
  }
}
