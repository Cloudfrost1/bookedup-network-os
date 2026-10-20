import { Badge } from "@/components/ui/card";
import type { OrgAccess } from "@/modules/auth/session";

export function OrgCard({ org, role }: { org: OrgAccess; role: string }) {
  return (
    <div className="grid gap-1 rounded-lg border border-border px-3 py-2">
      <span className="truncate text-sm font-medium">{org.name}</span>
      <span className="flex flex-wrap items-center gap-1">
        <Badge tone={org.status === "approved" ? "success" : org.status === "pending_review" ? "warning" : "danger"}>
          {org.status === "pending_review" ? "Under review" : org.status[0].toUpperCase() + org.status.slice(1)}
        </Badge>
        <span className="text-xs text-muted">{role}</span>
      </span>
    </div>
  );
}
