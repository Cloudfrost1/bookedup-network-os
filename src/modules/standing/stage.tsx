import Link from "next/link";
import { Rocket, Sparkles } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Provider COMMERCIAL status (mirrors app_private.provider_stage). Separate from the operational role. */
export type Stage =
  | "not_applied"
  | "application_incomplete"
  | "under_review"
  | "verified"
  | "trial_eligible"
  | "trial_delivered"
  | "growth_active"
  | "growth_extended"
  | "growth_completed"
  | "paused"
  | "rejected"
  | "overflow_provider";

type Tone = "success" | "warning" | "danger" | "neutral" | "purple";

export const STAGE: Record<Stage, { label: string; tone: Tone; text: string }> = {
  not_applied: { label: "Not applied", tone: "neutral", text: "This business only refers projects." },
  application_incomplete: {
    label: "Application incomplete",
    tone: "warning",
    text: "Complete your services, cities, capacity and documents so BookedUp can review your application.",
  },
  under_review: { label: "Under review", tone: "warning", text: "BookedUp is reviewing your application and documents." },
  verified: {
    label: "Verified provider",
    tone: "success",
    text: "Verified providers may be selected for one complimentary qualified opportunity when a compatible project becomes available. No volume is guaranteed.",
  },
  trial_eligible: {
    label: "Complimentary opportunity",
    tone: "purple",
    text: "You were selected for one complimentary qualified opportunity. BookedUp sends it when a compatible project becomes available — no date or volume is guaranteed.",
  },
  trial_delivered: { label: "Complimentary opportunity delivered", tone: "purple", text: "Your complimentary opportunity has been delivered." },
  growth_active: { label: "BookedUp Growth · Active", tone: "success", text: "Your Growth program is running. Track your qualified requests below." },
  growth_extended: {
    label: "BookedUp Growth · Extended",
    tone: "warning",
    text: "Your Growth program was extended to complete the contracted qualified requests.",
  },
  growth_completed: { label: "BookedUp Growth · Completed", tone: "neutral", text: "Your Growth program is complete." },
  paused: { label: "Paused", tone: "warning", text: "Project delivery is paused for this business. Contact BookedUp to resume." },
  rejected: { label: "Not approved", tone: "danger", text: "This business is not approved to receive projects. Contact BookedUp support." },
  overflow_provider: {
    label: "Contingency provider",
    tone: "purple",
    text: "You may receive opportunities when no BookedUp Growth client can serve a compatible project.",
  },
};

export const stageLabel = (s?: string | null) => (s && s in STAGE ? STAGE[s as Stage].label : "—");
export const stageTone = (s?: string | null): Tone => (s && s in STAGE ? STAGE[s as Stage].tone : "neutral");

const SHOW_GROWTH_CTA: Stage[] = ["verified", "trial_eligible", "trial_delivered", "growth_completed", "overflow_provider"];

/** Where the provider is in the journey, what it means, and the one next step. */
export function ProviderJourney({ stage }: { stage: Stage }) {
  if (stage === "not_applied") return null;
  const s = STAGE[stage];
  return (
    <Card className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg">
          <Sparkles aria-hidden className="size-5 text-primary" /> Provider status
        </h2>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      <p className="m-0 text-sm">{s.text}</p>
      {stage === "trial_delivered" || stage === "growth_completed" ? (
        <p className="m-0 text-sm font-semibold">Want a predictable flow of qualified estimate requests? Apply for BookedUp Growth.</p>
      ) : null}
      {SHOW_GROWTH_CTA.includes(stage) ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/provider/growth#review">
              <Rocket aria-hidden /> Schedule a Growth Review
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <a href="https://bookedup.prospeny.com/" target="_blank" rel="noopener noreferrer">
              See if Growth fits your business
            </a>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
