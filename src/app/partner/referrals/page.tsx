import Link from "next/link";
import type { Metadata } from "next";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { FormMessage } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/modules/network/org";
import { sendPartnerFeedback } from "@/modules/referrals/actions";
import { date, referralStatusLabel, toneFor } from "@/modules/format";
import { ReferralLinkCard } from "./referral-link";

export const metadata: Metadata = { title: "My Referrals" };

type Row = { id: string; number: number; service: string; city: string; status: string; channel: string; created_at: string; provider_name: string | null };

export default async function MyReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; photos_failed?: string; feedback?: string; error?: string }>;
}) {
  const { org } = await requireOrg("/partner/referrals");
  const sp = await searchParams;
  const approved = org.status === "approved" && org.can_refer;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_referrals", { p_org: org.id });
  const rows = (data ?? []) as Row[];
  const yn = (name: string, label: string) => (
    <label className="grid gap-1 text-xs">
      {label}
      <select name={name} defaultValue="" className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
        <option value="">Don&apos;t know</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );

  return (
    <>
      <PageHeader
        title="My Referrals"
        description="Every project your business shared and where it is now."
        action={
          approved ? (
            <Button asChild>
              <Link href="/partner/referrals/new">
                <Send aria-hidden /> Send Referral
              </Link>
            </Button>
          ) : null
        }
      />
      {sp.sent ? <FormMessage tone="success">Referral sent. BookedUp will confirm authorization with the homeowner and review it.</FormMessage> : null}
      {sp.photos_failed ? <FormMessage>{sp.photos_failed} photo(s) could not be uploaded. The referral itself was saved.</FormMessage> : null}
      {sp.feedback ? <FormMessage tone="success">Thanks. BookedUp will verify your feedback before it counts.</FormMessage> : null}
      <Flash sp={{ error: sp.error }} />
      {!approved ? <Card className="text-sm text-muted">Sending referrals opens after BookedUp approves your business.</Card> : <ReferralLinkCard orgId={org.id} />}
      {!rows.length ? (
        <EmptyState title="No referrals yet">When a customer asks for something you don&apos;t do, send it here or share your link.</EmptyState>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <Card key={r.id} className="grid gap-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid">
                  <span className="font-medium">
                    #{r.number} · {r.service}
                  </span>
                  <span className="text-sm text-muted">
                    {r.city} · {r.channel === "link" ? "Via your link" : "Sent by you"} · {date(r.created_at)}
                  </span>
                </div>
                <Badge tone={toneFor(r.status)}>{referralStatusLabel[r.status] ?? r.status}</Badge>
              </div>
              {r.provider_name ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary">Provider: {r.provider_name} · How did it go?</summary>
                  <form action={sendPartnerFeedback} className="mt-3 grid gap-3 rounded-lg bg-surface p-3">
                    <input type="hidden" name="referralId" value={r.id} />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {yn("contacted", "Contacted the customer quickly?")}
                      {yn("showed", "Showed up to the visit?")}
                      {yn("kept", "Kept what was promised?")}
                      <label className="grid gap-1 text-xs">
                        Rating
                        <select name="rating" defaultValue="" className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                          <option value="">—</option>
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <input name="comment" maxLength={1000} placeholder="What did the customer tell you? (optional)" aria-label="Comment" className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
                    <Button size="sm" variant="secondary" className="justify-self-start">Send feedback</Button>
                    <p className="text-xs text-muted">BookedUp confirms feedback with the homeowner before it affects the provider&apos;s history.</p>
                  </form>
                </details>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
