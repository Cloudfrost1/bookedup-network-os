import { Shell } from "@/components/layout/shell";
import { requireAdmin } from "@/modules/auth/session";
import { adminNav, visibleItems } from "@/modules/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAdmin();
  const items = visibleItems(adminNav, { approved: true, refer: true, receive: true });
  return (
    <Shell items={items} homeHref="/admin" title={access.platformRole === "super_admin" ? "Super admin" : "Admin"} userLabel={access.email}>
      {children}
    </Shell>
  );
}
