import "server-only";
import { redirect } from "next/navigation";
import { requireUser, type OrgAccess } from "@/modules/auth/session";

/** The signed-in user's business (the MVP uses one business per account). */
export async function requireOrg(next = "/app"): Promise<{ org: OrgAccess; userId: string; email: string }> {
  const access = await requireUser(next);
  const org = access.organizations[0];
  if (!org) redirect("/onboarding");
  return { org, userId: access.userId, email: access.email };
}

export async function requireCapability(cap: "refer" | "receive", next: string) {
  const ctx = await requireOrg(next);
  const ok = ctx.org.status === "approved" && (cap === "refer" ? ctx.org.can_refer : ctx.org.can_receive);
  if (!ok) redirect(`/${cap === "refer" ? "partner" : "provider"}?blocked=1`);
  return ctx;
}
