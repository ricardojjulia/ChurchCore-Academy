import { createClient } from "@/lib/supabase/server";

export interface InstitutionProfile {
  tenantId: string;
  institutionName: string;
  legalName: string;
  primaryMode: string;
}

export async function getInstitutionProfile(tenantId: string): Promise<InstitutionProfile | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("academy_institution_profiles")
      .select("tenant_id, institution_name, legal_name, primary_mode")
      .eq("tenant_id", tenantId)
      .single();

    if (error || !data) {
      console.error("Failed to fetch institution profile:", error);
      return null;
    }

    return {
      tenantId: data.tenant_id,
      institutionName: data.institution_name,
      legalName: data.legal_name,
      primaryMode: data.primary_mode,
    };
  } catch (err) {
    console.error("Error fetching institution profile:", err);
    return null;
  }
}
