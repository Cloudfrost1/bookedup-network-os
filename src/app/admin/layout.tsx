import { Shell } from "@/components/layout/shell";
import { EnvSwitcher } from "@/components/layout/env-switcher";
import { requireAdmin } from "@/modules/auth/session";
import { environmentsFor, type Environment } from "@/modules/auth/environments";
import { adminNav } from "@/modules/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAdmin();
  const e = environmentsFor(access);
  const available = (["partner", "provider", "admin"] as Environment[]).filter((x) => e[x]);
  return (
    <Shell
      items={adminNav}
      homeHref="/admin"
      title={access.platformRole === "super_admin" ? "BookedUp Admin · Super admin" : "BookedUp Admin"}
      userLabel={access.email}
      context={<EnvSwitcher current="admin" available={available} />}
    >
      {children}
    </Shell>
  );
}
