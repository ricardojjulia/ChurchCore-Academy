"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PrimaryMode =
  | "bible_school"
  | "childrens_school"
  | "seminary"
  | "college"
  | "university"
  | "mixed";

interface PlatformTenantMembership {
  personId: string;
  tenantId: string;
  roles: string[];
}

interface PlatformSessionPayload {
  platformRoles: string[];
  activeTenant?: PlatformTenantMembership;
  tenants: PlatformTenantMembership[];
}

interface TenantControlPanelProps {
  defaultAdminEmail?: string | null;
  initialSession: PlatformSessionPayload;
}

const modeOptions: Array<{ value: PrimaryMode; label: string }> = [
  { value: "mixed", label: "Mixed" },
  { value: "bible_school", label: "Bible School" },
  { value: "childrens_school", label: "Children's School" },
  { value: "seminary", label: "Seminary" },
  { value: "college", label: "College" },
  { value: "university", label: "University" },
];

function formatRoleSummary(roles: string[]) {
  return roles.length > 0 ? roles.join(", ") : "none";
}

export function TenantControlPanel({ defaultAdminEmail, initialSession }: TenantControlPanelProps) {
  const [session, setSession] = useState<PlatformSessionPayload>(initialSession);
  const [loadingSession, setLoadingSession] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tenantId, setTenantId] = useState("cca-demo");
  const [displayName, setDisplayName] = useState("ChurchCore Academy Demo");
  const [institutionName, setInstitutionName] = useState("ChurchCore Academy Demo");
  const [legalName, setLegalName] = useState("ChurchCore Academy Demo");
  const [primaryMode, setPrimaryMode] = useState<PrimaryMode>("mixed");
  const [adminDisplayName, setAdminDisplayName] = useState("Platform Admin");
  const [adminEmail, setAdminEmail] = useState(defaultAdminEmail ?? "admin@churchcore.academy");
  const [isDemo, setIsDemo] = useState(true);

  const canCreateTenant = useMemo(
    () => session?.platformRoles.includes("platform_admin") === true,
    [session],
  );

  const loadSession = useCallback(async () => {
    setLoadingSession(true);
    setActionError(null);

    try {
      const response = await fetch("/api/platform/session", { cache: "no-store" });
      const payload = (await response.json()) as PlatformSessionPayload | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Unable to load platform session.");
      }

      setSession(payload as PlatformSessionPayload);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to load platform session.");
    } finally {
      setLoadingSession(false);
    }
  }, []);

  async function selectTenant(nextTenantId: string) {
    setSubmitting(true);
    setActionError(null);
    setActionInfo(null);

    try {
      const response = await fetch("/api/platform/tenants/select", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: nextTenantId }),
      });

      const payload = (await response.json()) as
        | { activeTenant: PlatformTenantMembership; tenants: PlatformTenantMembership[] }
        | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Unable to select tenant.");
      }

      setSession((previous) => {
        if (!previous) {
          return {
            platformRoles: [],
            activeTenant: (payload as { activeTenant: PlatformTenantMembership }).activeTenant,
            tenants: (payload as { tenants: PlatformTenantMembership[] }).tenants,
          };
        }

        return {
          ...previous,
          activeTenant: (payload as { activeTenant: PlatformTenantMembership }).activeTenant,
          tenants: (payload as { tenants: PlatformTenantMembership[] }).tenants,
        };
      });

      setActionInfo(`Active tenant updated to ${nextTenantId}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to select tenant.");
    } finally {
      setSubmitting(false);
    }
  }

  async function createTenant() {
    setSubmitting(true);
    setActionError(null);
    setActionInfo(null);

    try {
      const response = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId,
          displayName,
          institutionName,
          legalName,
          primaryMode,
          lifecycleStatus: isDemo ? "demo" : "development",
          isDemo,
          initialInstitutionAdmin: {
            displayName: adminDisplayName,
            email: adminEmail,
          },
        }),
      });

      const payload = (await response.json()) as
        { tenant?: { tenantId: string }; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create tenant.");
      }

      const createdTenantId = payload.tenant?.tenantId ?? tenantId;
      setActionInfo(`Tenant ${createdTenantId} created.`);
      await loadSession();
      await selectTenant(createdTenantId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to create tenant.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTenant(tenantIdToDelete: string) {
    if (!window.confirm(`Are you sure you want to delete tenant "${tenantIdToDelete}"? This cannot be undone.`)) {
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setActionInfo(null);

    try {
      const response = await fetch(`/api/platform/tenants/${tenantIdToDelete}/delete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete tenant.");
      }

      setActionInfo(`Tenant ${tenantIdToDelete} deleted.`);
      await loadSession();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to delete tenant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Card className="relative z-10">
        <CardHeader>
          <CardTitle>Platform session</CardTitle>
          <CardDescription>Active tenant and platform permissions for this account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {loadingSession ? <p>Loading platform session...</p> : null}
          {!loadingSession && session ? (
            <>
              <p><strong>Platform roles:</strong> {formatRoleSummary(session.platformRoles)}</p>
              <p><strong>Active tenant:</strong> {session.activeTenant?.tenantId ?? "none"}</p>
              <div className="grid gap-2">
                <strong>Accessible tenants</strong>
                {session.tenants.length === 0 ? <p>No tenant memberships found.</p> : null}
                {session.tenants.map((tenant) => (
                  <div
                    key={tenant.tenantId}
                    className="relative z-20 flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold">{tenant.tenantId}</div>
                      <div className="text-xs text-muted-foreground">{formatRoleSummary(tenant.roles)}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="relative z-30 shrink-0"
                        type="button"
                        size="sm"
                        variant={session.activeTenant?.tenantId === tenant.tenantId ? "secondary" : "outline"}
                        disabled={submitting || session.activeTenant?.tenantId === tenant.tenantId}
                        onClick={() => void selectTenant(tenant.tenantId)}
                      >
                        {session.activeTenant?.tenantId === tenant.tenantId ? "Active" : "Select"}
                      </Button>
                      <Button
                        className="relative z-30 shrink-0"
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={submitting}
                        onClick={() => void deleteTenant(tenant.tenantId)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {!loadingSession && !session ? <p>Unable to load platform session.</p> : null}
        </CardContent>
      </Card>

      <Card className="relative z-0">
        <CardHeader>
          <CardTitle>Create tenant</CardTitle>
          <CardDescription>Create a tenant and immediately switch into it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tenant-id">Tenant ID</Label>
            <Input id="tenant-id" value={tenantId} onChange={(event) => setTenantId(event.currentTarget.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="institution-name">Institution name</Label>
              <Input id="institution-name" value={institutionName} onChange={(event) => setInstitutionName(event.currentTarget.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="legal-name">Legal name</Label>
              <Input id="legal-name" value={legalName} onChange={(event) => setLegalName(event.currentTarget.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="primary-mode">Primary mode</Label>
            <select
              id="primary-mode"
              value={primaryMode}
              onChange={(event) => setPrimaryMode(event.currentTarget.value as PrimaryMode)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {modeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="admin-display-name">Initial admin display name</Label>
              <Input id="admin-display-name" value={adminDisplayName} onChange={(event) => setAdminDisplayName(event.currentTarget.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-email">Initial admin email</Label>
              <Input id="admin-email" value={adminEmail} onChange={(event) => setAdminEmail(event.currentTarget.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDemo}
              onChange={(event) => setIsDemo(event.currentTarget.checked)}
            />
            Mark tenant as DEMO
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void createTenant()} disabled={submitting || !canCreateTenant}>
              {submitting ? "Working..." : "Create tenant"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting || !canCreateTenant}
              onClick={() => {
                setTenantId("cca-demo");
                setDisplayName("ChurchCore Academy Demo");
                setInstitutionName("ChurchCore Academy Demo");
                setLegalName("ChurchCore Academy Demo");
                setPrimaryMode("mixed");
                setIsDemo(true);
              }}
            >
              Preset DEMO tenant
            </Button>
          </div>

          {!canCreateTenant ? (
            <p className="text-sm text-rose-700">This account needs platform_admin to create tenants.</p>
          ) : null}

          {actionError ? <p className="text-sm text-rose-700">{actionError}</p> : null}
          {actionInfo ? <p className="text-sm text-emerald-700">{actionInfo}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
