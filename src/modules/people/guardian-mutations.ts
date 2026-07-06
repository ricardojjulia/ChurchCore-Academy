import { AcademyActor } from "@/modules/academy-auth/policy";
import { Person, StudentRelationship, StudentRelationshipAuthority, StudentRelationshipVisibility } from "@/modules/people/types";
import { createPerson, CreatePersonInput } from "@/modules/people/person-mutations";
import { createStudentRelationship, CreateRelationshipInput } from "@/modules/people/relationship-mutations";
import crypto from "node:crypto";

interface Queryable {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
}

export interface CreateGuardianWithLinkInput extends CreatePersonInput {
  studentPersonId: string;
  relationshipType: "guardian" | "parent";
  authority: StudentRelationshipAuthority;
  visibility: StudentRelationshipVisibility;
  startsOn?: string;
  endsOn?: string;
}

function assertTenantIsolation(actor: AcademyActor, tenantId: string) {
  if (actor.tenantId !== tenantId) {
    throw new Error("Cross-tenant access is forbidden.");
  }
}

function assertRole(actor: AcademyActor, allowedRoles: ReadonlySet<string>, action: string) {
  if (!actor.roles.some((role) => allowedRoles.has(role))) {
    throw new Error(`Forbidden: ${action} requires one of roles: ${Array.from(allowedRoles).join(", ")}.`);
  }
}

async function emitAuditEvent(
  actor: AcademyActor,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
  db: Queryable,
): Promise<void> {
  await db.query(
    `insert into academy_audit_events (
      tenant_id, actor_person_id, action, entity_type, entity_id, result_status, redacted_metadata
    ) values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [actor.tenantId, actor.userId, action, entityType, entityId, "success", JSON.stringify(metadata)],
  );
}

const guardianWriteRoles = new Set(["institution_admin", "registrar", "admissions"]);

export async function createGuardianWithLink(
  actor: AcademyActor,
  input: CreateGuardianWithLinkInput,
  db: Queryable,
): Promise<{ person: Person; relationship: StudentRelationship }> {
  assertTenantIsolation(actor, actor.tenantId);
  assertRole(actor, guardianWriteRoles, "create guardian with link");

  // Verify student exists in tenant
  const student = await db.query(
    `select id from academy_people where tenant_id = $1 and id = $2`,
    [actor.tenantId, input.studentPersonId],
  );

  if (!student.rowCount || student.rowCount === 0) {
    throw new Error("Student not found in this tenant.");
  }

  // Step 1: Create the person
  const personInput: CreatePersonInput = {
    displayName: input.displayName,
    givenName: input.givenName,
    familyName: input.familyName,
    preferredName: input.preferredName,
    email: input.email,
    phone: input.phone,
    dateOfBirth: input.dateOfBirth,
    personStatus: input.personStatus,
  };

  const person = await createPerson(actor, personInput, db);

  // Step 2: Create the relationship
  const relationshipInput: CreateRelationshipInput = {
    studentPersonId: input.studentPersonId,
    relatedPersonId: person.id,
    relationshipType: input.relationshipType,
    authority: input.authority,
    visibility: input.visibility,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
  };

  const relationship = await createStudentRelationship(actor, relationshipInput, db);

  // Step 3: Create role assignment for guardian
  const roleAssignmentId = crypto.randomUUID();
  await db.query(
    `insert into academy_person_role_assignments (
      id, tenant_id, person_id, role, scope_type, scope_id, status, created_at, updated_at
    ) values ($1, $2, $3, 'guardian', 'student', $4, 'active', now(), now())`,
    [roleAssignmentId, actor.tenantId, person.id, input.studentPersonId],
  );

  await emitAuditEvent(
    actor,
    "create_role_assignment",
    "person_role_assignment",
    roleAssignmentId,
    {
      person_id: person.id,
      role: "guardian",
      scope_type: "student",
      scope_id: input.studentPersonId,
    },
    db,
  );

  return { person, relationship };
}
