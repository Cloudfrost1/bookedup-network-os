import { CheckCircle2, Circle } from "lucide-react";
import { Badge, Card, StatCard } from "@/components/ui/card";
import { date } from "@/modules/format";

export type Reliability = {
  received: number;
  answered: number;
  median_response_hours: number | null;
  answered_within_24h: number;
  accepted: number;
  first_contact_within_48h: number;
  stale_offers: number;
  stalled: number;
  outcomes: number;
  appointments: number;
  verified_feedback: number;
  showed_up_yes: number;
  showed_up_answered: number;
  kept_yes: number;
  kept_answered: number;
  avg_rating: number | null;
  docs_verified: boolean;
  capacity_confirmed_at: string | null;
  accepting_new_work: boolean | null;
  trusted: boolean;
};

const ratio = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

/** Every number comes from recorded events. Feedback counts only after BookedUp verifies it. */
export function ReliabilityView({ r }: { r: Reliability }) {
  const showRate = r.showed_up_answered ? r.showed_up_yes / r.showed_up_answered : 0;
  const rules = [
    { done: r.docs_verified, label: "Valid license and insurance verified by BookedUp" },
    { done: r.accepted >= 5, label: `At least 5 accepted opportunities (${r.accepted})` },
    { done: r.verified_feedback >= 3, label: `At least 3 verified feedbacks (${r.verified_feedback})` },
    { done: (r.avg_rating ?? 0) >= 4, label: `Average verified rating 4.0 or higher (${r.avg_rating ?? "—"})` },
    { done: r.showed_up_answered > 0 && showRate >= 0.9, label: `Showed up to at least 90% of appointments (${ratio(r.showed_up_yes, r.showed_up_answered)})` },
    { done: r.stalled === 0, label: `No project left without an update for 7+ days (${r.stalled})` },
  ];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {r.trusted ? <Badge tone="purple">BookedUp Trusted Provider</Badge> : <Badge>No quality badge yet</Badge>}
        {r.docs_verified ? <Badge tone="success">Verified documents</Badge> : <Badge tone="warning">Documents not verified</Badge>}
        <Badge tone={r.accepting_new_work === false ? "warning" : "neutral"}>
          Capacity {r.capacity_confirmed_at ? `confirmed ${date(r.capacity_confirmed_at)}` : "not confirmed"}
        </Badge>
      </div>
      <h3 className="font-semibold">Response</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Opportunities received" value={r.received} hint="Last 180 days" />
        <StatCard label="Median response time" value={r.median_response_hours != null ? `${r.median_response_hours}h` : "—"} />
        <StatCard label="Answered within 24h" value={ratio(r.answered_within_24h, r.answered)} />
        <StatCard label="Left without answer 48h+" value={r.stale_offers} />
      </div>
      <h3 className="font-semibold">Commitments</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="First contact within 48h" value={ratio(r.first_contact_within_48h, r.accepted)} hint="After accepting" />
        <StatCard label="Showed up to appointment" value={ratio(r.showed_up_yes, r.showed_up_answered)} hint="Verified feedback" />
        <StatCard label="Kept commitments" value={ratio(r.kept_yes, r.kept_answered)} hint="Verified feedback" />
        <StatCard label="Projects without update 7d+" value={r.stalled} />
      </div>
      <h3 className="font-semibold">Verified feedback</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Verified feedbacks" value={r.verified_feedback} />
        <StatCard label="Average rating" value={r.avg_rating ?? "—"} hint="1 to 5" />
        <StatCard label="Appointments scheduled" value={r.appointments} />
        <StatCard label="Outcomes reported" value={r.outcomes} hint="Won or lost" />
      </div>
      <Card className="grid gap-2">
        <h3 className="font-semibold">How the Trusted Provider badge is earned</h3>
        {rules.map((x) => (
          <div key={x.label} className="flex items-center gap-2 text-sm">
            {x.done ? <CheckCircle2 aria-hidden className="size-4 shrink-0 text-primary" /> : <Circle aria-hidden className="size-4 shrink-0 text-muted" />}
            {x.label}
          </div>
        ))}
      </Card>
    </>
  );
}
