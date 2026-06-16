import { getDatabasePool } from "@/lib/database";
import { createInstitutionProfileDefaults } from "@/modules/academy-config/defaults";
import {
  PlatformAdminRepository,
  PlatformProvisionedTenant,
  PlatformTenantProvisioningInput,
  PlatformTenantSelection,
} from "@/modules/platform-admin/types";
import { randomUUID } from "node:crypto";

interface PlatformAdminDatabase {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
}

function inferTenantKind(primaryMode: PlatformTenantProvisioningInput["primaryMode"]) {
  if (primaryMode === "seminary") {
    return "seminary";
  }
  if (primaryMode === "college") {
    return "college";
  }
  if (primaryMode === "university") {
    return "university";
  }
  return "academy";
}

export class PostgresPlatformAdminRepository implements PlatformAdminRepository {
  constructor(
    private readonly database: PlatformAdminDatabase = getDatabasePool(),
  ) {}

  async saveActiveTenantSelection(
    selection: PlatformTenantSelection,
  ): Promise<void> {
    await this.database.query(
      `insert into public.academy_platform_user_preferences (
         external_subject,
         active_tenant_id,
         updated_at
       ) values ($1, $2, now())
       on conflict (external_subject)
       do update set
         active_tenant_id = excluded.active_tenant_id,
         updated_at = now()`,
      [selection.externalSubject, selection.tenantId],
    );

    await this.database.query(
      `insert into public.academy_platform_audit_events (
         external_subject,
         tenant_id,
         event_type,
         redacted_metadata
       ) values ($1, $2, 'tenant_selected', $3::jsonb)`,
      [
        selection.externalSubject,
        selection.tenantId,
        JSON.stringify({ tenantId: selection.tenantId }),
      ],
    );
  }

  async provisionTenant(
    input: PlatformTenantProvisioningInput,
  ): Promise<PlatformProvisionedTenant> {
    const now = new Date().toISOString();
    const profile = createInstitutionProfileDefaults({
      tenantId: input.tenantId,
      institutionName: input.institutionName,
      legalName: input.legalName,
      primaryMode: input.primaryMode,
      supportedModes: input.supportedModes,
      lmsProvider: "none",
      now,
    });

    const rootSubdivisionId = `subdivision-${input.tenantId}-root`;
    const adminPersonId = `person-${randomUUID()}`;
    const institutionAdminRoleAssignmentId = randomUUID();
    const registrarRoleAssignmentId = randomUUID();
    const accountLinkId = randomUUID();

    await this.database.query("begin");
    try {
      await this.database.query(
        `insert into public.academy_institution_profiles (
           tenant_id,
           institution_name,
           legal_name,
           primary_mode,
           supported_modes,
           operating_rules,
           capabilities,
           lms_preference,
           created_at,
           updated_at
         ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)`,
        [
          profile.tenantId,
          profile.institutionName,
          profile.legalName,
          profile.primaryMode,
          JSON.stringify(profile.supportedModes),
          JSON.stringify(profile.operatingRules),
          JSON.stringify(profile.capabilities),
          JSON.stringify(profile.lmsPreference),
          profile.createdAt,
          profile.updatedAt,
        ],
      );

      await this.database.query(
        `insert into public.academy_tenant_registry (
           tenant_id,
           display_name,
           tenant_kind,
           lifecycle_status,
           is_demo,
           provisioning_status,
           created_by_external_subject,
           created_at,
           updated_at
         ) values ($1, $2, $3, $4, $5, 'pending', $6, $7, $7)`,
        [
          input.tenantId,
          input.displayName,
          inferTenantKind(input.primaryMode),
          input.lifecycleStatus,
          input.isDemo,
          input.externalSubject,
          now,
        ],
      );

      await this.database.query(
        `insert into public.academy_calendar_profiles (
           tenant_id,
           calendar_system,
           default_term_structure,
           timezone,
           week_starts_on,
           uses_instructional_days,
           uses_enrollment_windows,
           uses_grading_windows,
           uses_transcript_periods,
           created_at,
           updated_at
         ) values ($1, $2, $3, 'UTC', 'monday', true, true, true, $4, $5, $5)`,
        [
          input.tenantId,
          profile.operatingRules.defaultCalendarSystem,
          profile.operatingRules.defaultTermStructure,
          profile.operatingRules.usesTranscripts,
          now,
        ],
      );

      await this.database.query(
        `insert into public.academy_grading_profiles (
           tenant_id,
           default_evaluation_type,
           default_official_record_type,
           supports_gpa,
           supports_credits,
           supports_clock_hours,
           supports_competencies,
           supports_narrative_evaluation,
           supports_promotion,
           supports_graduation_audit,
           grade_release_policy,
           guardian_visibility_policy,
           created_at,
           updated_at
         ) values (
           $1,
           'letter_grade',
           $2,
           $3,
           $4,
           $5,
           false,
           false,
           true,
           $6,
           'approval_required',
           'guardian_scoped',
           $7,
           $7
         )`,
        [
          input.tenantId,
          profile.operatingRules.officialRecordName,
          profile.operatingRules.usesGpa,
          profile.operatingRules.usesCredits,
          profile.operatingRules.usesClockHours,
          profile.capabilities.graduationWorkflows,
          now,
        ],
      );

      await this.database.query(
        `insert into public.academy_course_catalog_profiles (
           tenant_id,
           default_course_record_type,
           default_duration_unit,
           supports_credits,
           supports_clock_hours,
           supports_competencies,
           supports_narrative_evaluation,
           supports_grade_levels,
           supports_lms_mapping,
           created_at,
           updated_at
         ) values ($1, $2, 'term', $3, $4, false, false, $5, $6, $7, $7)`,
        [
          input.tenantId,
          profile.operatingRules.officialRecordName,
          profile.operatingRules.usesCredits,
          profile.operatingRules.usesClockHours,
          profile.operatingRules.usesGradeLevels,
          profile.capabilities.lmsLaunch,
          now,
        ],
      );

      await this.database.query(
        `insert into public.academy_thresholds (
           tenant_id,
           incomplete_enrollment_days,
           graduation_credit_threshold,
           credit_pace_gap,
           minimum_gpa,
           faculty_load_threshold,
           advisor_student_ratio_threshold
         ) values ($1, 10, 0.95, 9, 2, 4, 25)
         on conflict (tenant_id) do update set
           incomplete_enrollment_days = excluded.incomplete_enrollment_days,
           graduation_credit_threshold = excluded.graduation_credit_threshold,
           credit_pace_gap = excluded.credit_pace_gap,
           minimum_gpa = excluded.minimum_gpa,
           faculty_load_threshold = excluded.faculty_load_threshold,
           advisor_student_ratio_threshold = excluded.advisor_student_ratio_threshold`,
        [input.tenantId],
      );

      await this.database.query(
        `insert into public.academy_institution_subdivisions (
           id,
           tenant_id,
           parent_subdivision_id,
           name,
           code,
           subdivision_type,
           institution_mode,
           status,
           created_at,
           updated_at
         ) values ($1, $2, null, 'Main Campus', 'MAIN', 'campus', $3, 'active', $4, $4)`,
        [rootSubdivisionId, input.tenantId, input.primaryMode, now],
      );

      await this.database.query(
        `insert into public.academy_people (
           id,
           tenant_id,
           display_name,
           given_name,
           family_name,
           email,
           person_status,
           created_at,
           updated_at
         ) values ($1, $2, $3, $4, $5, $6, 'active', $7, $7)`,
        [
          adminPersonId,
          input.tenantId,
          input.initialInstitutionAdmin.displayName,
          input.initialInstitutionAdmin.givenName ?? null,
          input.initialInstitutionAdmin.familyName ?? null,
          input.initialInstitutionAdmin.email ?? null,
          now,
        ],
      );

      await this.database.query(
        `insert into public.academy_person_role_assignments (
           id,
           tenant_id,
           person_id,
           role,
           scope_type,
           scope_id,
           status,
           created_at,
           updated_at
         ) values
           ($1, $2, $3, 'institution_admin', 'institution', $2, 'active', $4, $4),
           ($5, $2, $3, 'registrar', 'institution', $2, 'active', $4, $4)`,
        [
          institutionAdminRoleAssignmentId,
          input.tenantId,
          adminPersonId,
          now,
          registrarRoleAssignmentId,
        ],
      );

      await this.database.query(
        `insert into public.academy_account_links (
           id,
           tenant_id,
           person_id,
           provider,
           external_subject,
           status,
           created_at,
           updated_at
         ) values ($1, $2, $3, 'supabase', $4, 'active', $5, $5)
         on conflict (tenant_id, provider, external_subject)
         do update set
           person_id = excluded.person_id,
           status = 'active',
           updated_at = excluded.updated_at`,
        [accountLinkId, input.tenantId, adminPersonId, input.externalSubject, now],
      );

      await this.database.query(
        `insert into public.academy_platform_user_preferences (
           external_subject,
           active_tenant_id,
           created_at,
           updated_at
         ) values ($1, $2, $3, $3)
         on conflict (external_subject)
         do update set
           active_tenant_id = excluded.active_tenant_id,
           updated_at = excluded.updated_at`,
        [input.externalSubject, input.tenantId, now],
      );

      await this.database.query(
        `insert into public.academy_platform_audit_events (
           external_subject,
           tenant_id,
           event_type,
           redacted_metadata,
           occurred_at
         ) values
           ($1, $2, 'tenant_created', $3::jsonb, $4),
           ($1, $2, 'tenant_user_provisioned', $5::jsonb, $4),
           ($1, $2, 'tenant_provisioning_completed', $6::jsonb, $4)`,
        [
          input.externalSubject,
          input.tenantId,
          JSON.stringify({
            tenantId: input.tenantId,
            lifecycleStatus: input.lifecycleStatus,
          }),
          now,
          JSON.stringify({
            tenantId: input.tenantId,
            personId: adminPersonId,
            roles: ["institution_admin", "registrar"],
          }),
          JSON.stringify({
            tenantId: input.tenantId,
            provisioningStatus: "ready",
          }),
        ],
      );

      await this.database.query(
        `update public.academy_tenant_registry
         set provisioning_status = 'ready',
             updated_at = $2
         where tenant_id = $1`,
        [input.tenantId, now],
      );

      await this.database.query("commit");
      return {
        tenantId: input.tenantId,
        displayName: input.displayName,
        lifecycleStatus: input.lifecycleStatus,
        isDemo: input.isDemo,
        provisioningStatus: "ready",
        initialAdminPersonId: adminPersonId,
      };
    } catch (error) {
      await this.database.query("rollback");
      const message = error instanceof Error ? error.message : "";
      if (
        message.includes("duplicate key") ||
        message.includes("violates unique constraint") ||
        message.includes("already exists")
      ) {
        throw new Error("Tenant already exists.");
      }
      throw error;
    }
  }

  async deleteTenant(tenantId: string): Promise<void> {
    await this.database.query("begin");
    try {
      // Delete all tenant-scoped data in reverse dependency order
      await this.database.query(
        `delete from public.academy_platform_audit_events where tenant_id = $1`,
        [tenantId],
      );

      await this.database.query(
        `delete from public.academy_thresholds where tenant_id = $1`,
        [tenantId],
      );

      await this.database.query(
        `delete from public.academy_course_catalog_profiles where tenant_id = $1`,
        [tenantId],
      );

      await this.database.query(
        `delete from public.academy_grading_profiles where tenant_id = $1`,
        [tenantId],
      );

      await this.database.query(
        `delete from public.academy_calendar_profiles where tenant_id = $1`,
        [tenantId],
      );

      await this.database.query(
        `delete from public.academy_institution_profiles where tenant_id = $1`,
        [tenantId],
      );

      await this.database.query(
        `delete from public.academy_tenant_registry where tenant_id = $1`,
        [tenantId],
      );

      await this.database.query(
        `delete from public.academy_platform_user_preferences where active_tenant_id = $1`,
        [tenantId],
      );

      await this.database.query("commit");
    } catch (error) {
      await this.database.query("rollback");
      throw error;
    }
  }
}