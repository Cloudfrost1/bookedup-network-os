import { Badge } from "@/components/ui/card";
import type { OrgAccess } from "@/modules/auth/session";
import type { Standing } from "@/modules/standing/standing";

/** Sidebar card: membership and the one status that matters in this area, never a bare "Approved". */
export function OrgCard({ org, env, standing }: { org: OrgAccess; env: "partner" | "provider"; standing: Standing | null }) {
  const member = org.status === "approved" ? "Member · Approved" : org.status === "pending_review" ? "Member · Under review" : `Member · ${org.status[0].toUpperCase()}${org.status.slice(1)}`;
  let area: { text: string; tone: "success" | "warning" | "danger" } | null = null;
  if (standing && env === "provider" && standing.receive !== null) {
    area = standing.eligible_to_receive ? { text: "Receiving projects", tone: "success" } : { text: "Not receiving projects", tone: "danger" };
  } else if (standing && env === "partner" && standing.refer !== null) {
    area =
      standing.referral_partner === "active"
        ? { text: "Referral partner · Active", tone: "success" }
        : standing.referral_partner === "pending"
          ? { text: "Referral partner · Pending", tone: "warning" }
          : { text: "Referral partner · Inactive", tone: "danger" };
  }
  return (
    <div className="grid gap-1.5 rounded-2xl border-2 border-line bg-background px-3 py-2.5">
      <span className="truncate text-sm font-medium">{org.name}</span>
      <span className="flex flex-wrap items-center gap-1">
        <Badge tone={org.status === "approved" ? "success" : org.status === "pending_review" ? "warning" : "danger"}>{member}</Badge>
        {area ? <Badge tone={area.tone}>{area.text}</Badge> : null}
      </span>
    </div>
  );
}
