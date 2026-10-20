import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { EnvSwitcher } from "@/components/layout/env-switcher";
import { OrgCard } from "@/components/layout/org-card";
import { requireUser } from "@/modules/auth/session";
import { environmentsFor, type Environment } from "@/modules/auth/environments";
import { partnerNav, providerNav, visibleItems } from "@/modules/navigation";

/** Shared guard + shell for the two business environments. */
export async function BusinessEnvLayout({ env, children }: { env: "partner" | "provider"; children: React.ReactNode }) {
  const access = await requireUser(`/${env}`);
  const e = environmentsFor(access);
  if (!e.org) redirect("/onboarding");
  // A business that only refers has no provider area (and vice versa); admins can still look at both.
  if (!e[env] && !e.admin) redirect("/app");
  const org = e.org!;
  const items = visibleItems(env === "partner" ? partnerNav : providerNav, {
    approved: org.status === "approved",
    refer: org.status === "approved" && org.can_refer,
    receive: org.status === "approved" && org.can_receive,
  });
  const available = (["partner", "provider", "admin"] as Environment[]).filter((x) => e[x]);
  if (!available.includes(env)) available.unshift(env);
  const context = (
    <div className="grid gap-3">
      <EnvSwitcher current={env} available={available} />
      <OrgCard org={org} role={env === "partner" ? "Referral partner" : "Service provider"} />
    </div>
  );
  return (
    <Shell
      items={items}
      homeHref={`/${env}`}
      title={env === "partner" ? "Partner area" : "Provider area"}
      userLabel={access.email}
      context={context}
    >
      {children}
    </Shell>
  );
}
