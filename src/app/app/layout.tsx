import { Shell } from "@/components/layout/shell";
import { Badge } from "@/components/ui/card";
import { requireUser } from "@/modules/auth/session";
import { appNav, visibleItems } from "@/modules/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const access = await requireUser("/app");
  const org = access.organizations[0];
  const items = visibleItems(appNav, {
    approved: org?.status === "approved",
    refer: Boolean(org?.can_refer),
    receive: Boolean(org?.can_receive),
  });

  const context = org ? (
    <div className="grid gap-1 rounded-lg border border-border px-3 py-2">
      <span className="truncate text-sm font-medium">{org.name}</span>
      <span>
        <Badge tone={org.status === "approved" ? "success" : org.status === "pending_review" ? "warning" : "danger"}>
          {org.status === "pending_review" ? "Pending Review" : org.status[0].toUpperCase() + org.status.slice(1)}
        </Badge>
      </span>
    </div>
  ) : null;

  return (
    <Shell items={items} homeHref="/app" title="Business account" userLabel={access.email} context={context}>
      {children}
    </Shell>
  );
}
