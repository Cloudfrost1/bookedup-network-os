import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/modules/network/org";
import { getStanding } from "@/modules/standing/standing";
import { ProviderJourney, type Stage } from "@/modules/standing/stage";
import { GrowthBlock, VALIDATION, type GrowthProgress } from "@/modules/growth/progress";
import { GrowthReviewForm } from "@/modules/growth/review-form";
import { date } from "@/modules/format";

export const metadata: Metadata = { title: "BookedUp Growth" };

type Delivery = { assignment_id: string; referral_number: number; service: string; delivered_at: string; validation: string; excluded: boolean };
type Review = { id: string; status: string; created_at: string };

const REVIEW_STATUS: Record<string, string> = {
  new: "Received — BookedUp will contact you",
  contacted: "In conversation",
  qualified: "Qualified for Growth",
  not_a_fit: "Not a fit right now",
  closed: "Closed",
};

export default async function ProviderGrowthPage() {
  const { org } = await requireOrg("/provider/growth");
  const supabase = await createClient();
  const [standing, { data: programs }, { data: deliveries }, { data: reviews }] = await Promise.all([
    getStanding(org.id),
    supabase.rpc("my_growth_program", { p_org: org.id }),
    supabase.rpc("my_growth_deliveries", { p_org: org.id }),
    supabase.from("growth_review_requests").select("id, status, created_at").eq("org_id", org.id).order("created_at", { ascending: false }).limit(1),
  ]);
  const program = ((programs ?? []) as GrowthProgress[])[0];
  const list = (deliveries ?? []) as Delivery[];
  const review = ((reviews ?? []) as Review[])[0];
  const inProgram = program && ["active", "continuation_required"].includes(program.status);
  const canRequest = org.role !== "member";

  return (
    <>
      <PageHeader
        title="BookedUp Growth"
        description="A 90-day program for qualified remodeling companies: qualified estimate requests plus the digital infrastructure to convert them."
      />
      {standing?.stage ? <ProviderJourney stage={standing.stage as Stage} /> : null}

      {program ? <GrowthBlock p={program} /> : null}

      {program ? (
        <section className="grid gap-3">
          <h2 className="text-lg">Requests in your program</h2>
          {!list.length ? (
            <EmptyState title="No requests yet">Qualified requests sent through your program appear here with their validation status.</EmptyState>
          ) : (
            <Table head={["#", "Service", "Sent", "Counts toward Growth?"]}>
              {list.map((d) => {
                const v = VALIDATION[d.excluded ? "invalidated" : d.validation] ?? VALIDATION.pending_validation;
                return (
                  <tr key={d.assignment_id}>
                    <Td className="tabular-nums text-muted">
                      <Link href={`/provider/opportunities/${d.assignment_id}`} className="text-primary hover:underline">
                        {d.referral_number}
                      </Link>
                    </Td>
                    <Td>{d.service}</Td>
                    <Td className="text-muted">{date(d.delivered_at)}</Td>
                    <Td>
                      <Badge tone={v.tone}>{v.label}</Badge>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </section>
      ) : null}

      {!inProgram ? (
        <Card className="grid gap-4">
          <div className="grid gap-2">
            <h2 className="text-lg">Is Growth right for your business?</h2>
            <p className="m-0 text-sm">
              BookedUp Growth helps qualified remodeling companies receive a contracted number of qualified estimate requests in 90 days while
              building the digital infrastructure needed to convert that demand (website, SEO and Google Business Profile).
            </p>
            <p className="m-0 text-sm text-muted">
              It&apos;s a consultative program, not a software plan. In a Growth Review we look at your capacity, average ticket, close rate, cities
              served and operation quality to confirm we can really deliver for you.
            </p>
          </div>
          {review && ["new", "contacted"].includes(review.status) ? (
            <p className="m-0 rounded-xl border-2 border-line bg-subtle px-4 py-3 text-sm font-semibold">
              Growth Review requested on {date(review.created_at)} · {REVIEW_STATUS[review.status]}
            </p>
          ) : canRequest ? (
            <div id="review" className="grid gap-3 border-t-2 border-dashed border-border pt-4">
              <h3 className="text-base">Schedule a Growth Review</h3>
              <GrowthReviewForm orgId={org.id} />
            </div>
          ) : (
            <p className="m-0 text-sm text-muted">Ask an owner or manager of your business to schedule a Growth Review.</p>
          )}
        </Card>
      ) : null}
    </>
  );
}
