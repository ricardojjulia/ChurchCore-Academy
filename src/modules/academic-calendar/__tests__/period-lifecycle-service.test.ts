import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { AcademicPeriodLifecycleService, InvalidStateTransitionError, PermanentRecordError } from "../period-lifecycle-service";
import type { Actor } from "@/lib/require-actor";
import type { AcademicPeriod } from "../types";

const mockRepo = {
  fetchPeriodById: async (tenantId: string, periodId: string) => {
    mockRepo.calls.fetchPeriodById.push({ tenantId, periodId });
    return mockRepo.returns.fetchPeriodById;
  },
  updatePeriodStatus: async (tenantId: string, periodId: string, status: any) => {
    mockRepo.calls.updatePeriodStatus.push({ tenantId, periodId, status });
    return mockRepo.returns.updatePeriodStatus;
  },
  createPeriod: async (tenantId: string, data: any) => {
    mockRepo.calls.createPeriod.push({ tenantId, data });
    return mockRepo.returns.createPeriod;
  },
  updatePeriod: async (tenantId: string, periodId: string, data: any) => {
    mockRepo.calls.updatePeriod.push({ tenantId, periodId, data });
    return mockRepo.returns.updatePeriod;
  },
  calls: {
    fetchPeriodById: [] as any[],
    updatePeriodStatus: [] as any[],
    createPeriod: [] as any[],
    updatePeriod: [] as any[],
  },
  returns: {
    fetchPeriodById: null as any,
    updatePeriodStatus: null as any,
    createPeriod: null as any,
    updatePeriod: null as any,
  },
  reset() {
    this.calls.fetchPeriodById = [];
    this.calls.updatePeriodStatus = [];
    this.calls.createPeriod = [];
    this.calls.updatePeriod = [];
    this.returns.fetchPeriodById = null;
    this.returns.updatePeriodStatus = null;
    this.returns.createPeriod = null;
    this.returns.updatePeriod = null;
  }
};

const mockAudit = {
  log: async (actor: any, action: string, metadata: any, level?: string) => {
    mockAudit.calls.log.push({ actor, action, metadata, level });
  },
  calls: {
    log: [] as any[],
  },
  reset() {
    this.calls.log = [];
  }
};

const mockDb = {} as any;

const adminActor: Actor = { tenantId: "t1", userId: "u1", roles: ["institution_admin"] };
const platformAdminActor: Actor = { tenantId: "t1", userId: "u-platform", roles: ["platform_admin"] };
const studentActor: Actor = { tenantId: "t1", userId: "u-student", roles: ["student"] };

describe("AcademicPeriodLifecycleService", () => {
  let service: AcademicPeriodLifecycleService;

  beforeEach(() => {
    mockRepo.reset();
    mockAudit.reset();
    service = new AcademicPeriodLifecycleService(mockDb, mockRepo, mockAudit);
  });

  describe("State Transitions", () => {
    it("should transition from planned to enrollment_open", async () => {
      const period: AcademicPeriod = { id: "p1", status: "planned" } as any;
      mockRepo.returns.fetchPeriodById = period;
      mockRepo.returns.updatePeriodStatus = { ...period, status: "enrollment_open" };

      await service.openEnrollment(adminActor, "p1");

      assert.deepEqual(mockRepo.calls.updatePeriodStatus[0], {
        tenantId: "t1",
        periodId: "p1",
        status: "enrollment_open",
      });
      assert.deepEqual(mockAudit.calls.log[0], {
        actor: adminActor,
        action: "academic_period.status_changed",
        metadata: { periodId: "p1", from: "planned", to: "enrollment_open" },
        level: undefined,
      });
    });

    it("should transition from enrollment_open to active", async () => {
      const period: AcademicPeriod = { id: "p1", status: "enrollment_open" } as any;
      mockRepo.returns.fetchPeriodById = period;
      mockRepo.returns.updatePeriodStatus = { ...period, status: "active" };

      await service.activatePeriod(adminActor, "p1");

      assert.deepEqual(mockRepo.calls.updatePeriodStatus[0], {
        tenantId: "t1",
        periodId: "p1",
        status: "active",
      });
      assert.deepEqual(mockAudit.calls.log[0], {
        actor: adminActor,
        action: "academic_period.status_changed",
        metadata: { periodId: "p1", from: "enrollment_open", to: "active" },
        level: undefined,
      });
    });

    it("should transition from active to completed", async () => {
      const period: AcademicPeriod = { id: "p1", status: "active" } as any;
      mockRepo.returns.fetchPeriodById = period;
      mockRepo.returns.updatePeriodStatus = { ...period, status: "completed" };

      await service.completePeriod(adminActor, "p1");

      assert.deepEqual(mockRepo.calls.updatePeriodStatus[0], {
        tenantId: "t1",
        periodId: "p1",
        status: "completed",
      });
      assert.deepEqual(mockAudit.calls.log[0], {
        actor: adminActor,
        action: "academic_period.status_changed",
        metadata: { periodId: "p1", from: "active", to: "completed" },
        level: undefined,
      });
    });

    it("should throw for an invalid transition", async () => {
      const period: AcademicPeriod = { id: "p1", status: "planned" } as any;
      mockRepo.returns.fetchPeriodById = period;

      await assert.rejects(
        service.activatePeriod(adminActor, "p1"),
        InvalidStateTransitionError
      );
    });
  });

  describe("Permissions", () => {
    it("should reject transitions from non-admin roles", async () => {
      await assert.rejects(
        service.openEnrollment(studentActor, "p1"),
        /Forbidden Academy access/i
      );
      await assert.rejects(
        service.activatePeriod(studentActor, "p1"),
        /Forbidden Academy access/i
      );
      await assert.rejects(
        service.completePeriod(studentActor, "p1"),
        /Forbidden Academy access/i
      );
    });

    it("should reject updates from non-admin roles", async () => {
      await assert.rejects(
        service.updatePeriod(studentActor, "p1", {}),
        /Forbidden Academy access/i
      );
    });
  });

  describe("updatePeriod", () => {
    it("should allow updating a 'planned' period", async () => {
      const period: AcademicPeriod = { id: "p1", status: "planned" } as any;
      mockRepo.returns.fetchPeriodById = period;
      mockRepo.returns.updatePeriod = { ...period, name: "New Name" };

      await service.updatePeriod(adminActor, "p1", { name: "New Name" });
      assert.deepEqual(mockRepo.calls.updatePeriod[0], {
        tenantId: "t1",
        periodId: "p1",
        data: { name: "New Name" },
      });
    });

    it("should prevent updating a period that is not 'planned'", async () => {
      const period: AcademicPeriod = { id: "p1", status: "active" } as any;
      mockRepo.returns.fetchPeriodById = period;

      await assert.rejects(
        service.updatePeriod(adminActor, "p1", { name: "New Name" }),
        PermanentRecordError
      );
    });
  });

  describe("reopenPeriod (Privileged Action)", () => {
    it("should allow a platform_admin to reopen a completed period with a reason", async () => {
      const period: AcademicPeriod = { id: "p1", status: "completed" } as any;
      mockRepo.returns.fetchPeriodById = period;
      mockRepo.returns.updatePeriodStatus = { ...period, status: "active" };

      await service.reopenPeriod(platformAdminActor, "t1", "p1", "Clerical error in final grades.");

      assert.deepEqual(mockRepo.calls.updatePeriodStatus[0], {
        tenantId: "t1",
        periodId: "p1",
        status: "active",
      });
      assert.deepEqual(mockAudit.calls.log[0], {
        actor: platformAdminActor,
        action: "academic_period.reopened",
        metadata: {
          tenantId: "t1",
          periodId: "p1",
          reason: "Clerical error in final grades.",
        },
        level: "HIGH",
      });
    });

    it("should reject reopening from non-platform_admin roles", async () => {
      await assert.rejects(
        service.reopenPeriod(adminActor, "t1", "p1", "some reason"),
        /Forbidden Academy access/i
      );
    });

    it("should reject reopening without a reason", async () => {
      await assert.rejects(
        service.reopenPeriod(platformAdminActor, "t1", "p1", " "),
        /reason is required/i
      );
    });

    it("should reject reopening a period that is not completed", async () => {
      const period: AcademicPeriod = { id: "p1", status: "active" } as any;
      mockRepo.returns.fetchPeriodById = period;

      await assert.rejects(
        service.reopenPeriod(platformAdminActor, "t1", "p1", "some reason"),
        InvalidStateTransitionError
      );
    });
  });
});