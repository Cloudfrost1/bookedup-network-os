import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

/** Mirrors public.org_standing(): four separate answers instead of one ambiguous "Approved". */
export type Standing = {
  membership: "pending_review" | "approved" | "suspended" | "rejected";
  refer: "requested" | "approved" | "revoked" | null;
  receive: "requested" | "approved" | "revoked" | null;
  referral_partner: "active" | "pending" | "inactive" | "not_requested";
  provider_verification: "complete" | "incomplete" | "not_requested";
  eligible_to_receive: boolean;
  blockers: string[];
  license: string;
  insurance: string;
};

export async function getStanding(orgId: string): Promise<Standing | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("org_standing", { p_org: orgId });
  return (data as Standing | null) ?? null;
}

type Fix = { text: string; href?: string; cta?: string };
const CAP = "/provider/capacity";
const BIZ = "/provider/business";

/** Why each blocker stops projects, and where to fix it. Codes come from app_private.provider_blockers(). */
export const BLOCKERS: Record<string, Fix> = {
  membership_pending_review: { text: "BookedUp is still reviewing your business." },
  membership_suspended: { text: "Your membership is suspended. Contact BookedUp support.", href: "/provider/support", cta: "Contact support" },
  membership_rejected: { text: "Your membership was not approved. Contact BookedUp support.", href: "/provider/support", cta: "Contact support" },
  membership_removed: { text: "This business was removed from the network." },
  receive_pending: { text: "Your request to receive projects is waiting for BookedUp approval." },
  receive_revoked: { text: "BookedUp turned off project delivery for this business. Contact support.", href: "/provider/support", cta: "Contact support" },
  license_missing: { text: "Upload your license (contractor license, or local business license for unlicensed trades).", href: CAP, cta: "Upload license" },
  license_in_review: { text: "Your license is waiting for BookedUp review." },
  license_expired: { text: "Your license expired. Upload the current one.", href: CAP, cta: "Upload license" },
  license_rejected: { text: "Your license was rejected. Upload a valid one.", href: CAP, cta: "Upload license" },
  insurance_missing: { text: "Upload your general liability (or workers' comp) insurance.", href: CAP, cta: "Upload insurance" },
  insurance_in_review: { text: "Your insurance is waiting for BookedUp review." },
  insurance_expired: { text: "Your insurance expired. Upload the current policy.", href: CAP, cta: "Upload insurance" },
  insurance_rejected: { text: "Your insurance was rejected. Upload a valid policy.", href: CAP, cta: "Upload insurance" },
  capacity_missing: { text: "Tell BookedUp your capacity: projects per week, project size and lead time.", href: CAP, cta: "Set capacity" },
  capacity_incomplete: { text: "Your capacity is incomplete: fill weekly projects, smallest and largest project and lead time.", href: CAP, cta: "Complete capacity" },
  capacity_stale: { text: "Your capacity confirmation is older than 30 days.", href: CAP, cta: "Confirm capacity" },
  capacity_zero: { text: "Weekly capacity is 0. Set at least 1 project per week.", href: CAP, cta: "Update capacity" },
  paused: { text: "You paused new projects.", href: CAP, cta: "Resume" },
  unavailable: { text: "“Available to receive new projects” is off.", href: BIZ, cta: "Turn on" },
  no_services: { text: "Add at least one service you offer.", href: BIZ, cta: "Add services" },
  no_areas: { text: "Add at least one city you serve.", href: BIZ, cta: "Add cities" },
};

const PARTNER_LABEL: Record<Standing["referral_partner"], string> = {
  active: "Active",
  pending: "Pending approval",
  inactive: "Inactive",
  not_requested: "Not requested",
};
const MEMBERSHIP_LABEL: Record<Standing["membership"], string> = {
  approved: "Approved",
  pending_review: "Under review",
  suspended: "Suspended",
  rejected: "Not approved",
};

type Tone = "success" | "warning" | "danger" | "neutral";
function Row({ label, value, tone, note }: { label: string; value: string; tone: Tone; note?: string }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" ? XCircle : tone === "warning" ? AlertTriangle : CircleDashed;
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-muted";
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-2 last:border-0">
      <span className="flex items-start gap-2">
        <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${color}`} />
        <span className="grid">
          <span className="font-medium">{label}</span>
          {note ? <span className="text-xs text-muted">{note}</span> : null}
        </span>
      </span>
      <Badge tone={tone === "neutral" ? "neutral" : tone}>{value}</Badge>
    </li>
  );
}

/** The four answers, side by side. `show` limits rows to the roles the business has. */
export function StandingPanel({ s, title = "Your status in the network" }: { s: Standing; title?: string }) {
  const refers = s.refer !== null;
  const receives = s.receive !== null;
  const memberTone: Tone = s.membership === "approved" ? "success" : s.membership === "pending_review" ? "warning" : "danger";
  return (
    <Card className="grid gap-2 text-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <ul className="grid p-0">
        <Row label="Network membership" value={MEMBERSHIP_LABEL[s.membership]} tone={memberTone} />
        {refers ? (
          <Row
            label="Referral partner"
            value={PARTNER_LABEL[s.referral_partner]}
            tone={s.referral_partner === "active" ? "success" : s.referral_partner === "pending" ? "warning" : "danger"}
            note={s.referral_partner === "active" ? "You can send referrals and appear in Find Partners." : undefined}
          />
        ) : null}
        {receives ? (
          <>
            <Row
              label="Provider verification"
              value={s.provider_verification === "complete" ? "Complete" : "Incomplete"}
              tone={s.provider_verification === "complete" ? "success" : "warning"}
              note="Verified license and insurance + capacity confirmed in the last 30 days."
            />
            <Row
              label="Eligible to receive projects"
              value={s.eligible_to_receive ? "Yes" : "No"}
              tone={s.eligible_to_receive ? "success" : "danger"}
            />
          </>
        ) : null}
      </ul>
    </Card>
  );
}

/** Banner that says exactly what is blocked and why. Renders nothing when nothing is blocked. */
export function BlockedBanner({ s, area, admin = false }: { s: Standing; area: "partner" | "provider"; admin?: boolean }) {
  if (area === "partner") {
    if (s.referral_partner === "active") return null;
    const why =
      s.membership !== "approved"
        ? BLOCKERS[`membership_${s.membership}`]?.text
        : s.referral_partner === "pending"
          ? "Your request to send referrals is waiting for BookedUp approval."
          : "Sending referrals is turned off for this business. Contact support.";
    return (
      <Card className="grid gap-1 border-warning/40 bg-warning/5 p-4 text-sm" role="status">
        <p className="m-0 font-semibold">Blocked: sending referrals and contacting partners</p>
        <p className="m-0 text-muted">{why}</p>
      </Card>
    );
  }
  if (s.eligible_to_receive || s.receive === null) return null;
  const items = s.blockers.filter((b) => b !== "receive_not_requested").map((b) => ({ code: b, ...(BLOCKERS[b] ?? { text: b }) }));
  return (
    <Card className="grid gap-3 border-danger/30 bg-danger/5 p-4 text-sm" role="status">
      <div className="grid gap-1">
        <p className="m-0 font-semibold">Blocked: receiving new projects</p>
        <p className="m-0 text-muted">
          {admin ? "This business can't be sent projects until" : "BookedUp can't send you projects until"}{" "}
          {items.length === 1 ? "this is" : `these ${items.length} items are`} resolved:
        </p>
      </div>
      <ul className="grid gap-2 p-0">
        {items.map((i) => (
          <li key={i.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <span>{i.text}</span>
            {admin ? null : i.href ? (
              <Link href={i.href} className="font-medium text-primary hover:underline">
                {i.cta ?? "Fix"}
              </Link>
            ) : (
              <span className="text-xs text-muted">Waiting for BookedUp</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
