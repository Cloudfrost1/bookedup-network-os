import type { Access, OrgAccess } from "@/modules/auth/session";

export type Environment = "admin" | "partner" | "provider";

/** Partner = the business refers projects (anchor). Provider = it receives them. Requested roles count while under review. */
export function environmentsFor(access: Access) {
  const org: OrgAccess | undefined = access.organizations[0];
  return {
    admin: Boolean(access.platformRole),
    partner: Boolean(org && (org.can_refer || org.requested.includes("refer"))),
    provider: Boolean(org && (org.can_receive || org.requested.includes("receive"))),
    org,
  };
}

export function homeFor(access: Access) {
  const e = environmentsFor(access);
  if (e.admin) return "/admin";
  if (!e.org) return "/onboarding";
  if (e.partner) return "/partner";
  if (e.provider) return "/provider";
  return "/partner";
}
