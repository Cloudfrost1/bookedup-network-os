import Link from "next/link";
import type { Metadata } from "next";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/shell";
import { Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/modules/network/org";
import { date, referralStatusLabel, toneFor } from "@/modules/format";
import { ReferralLinkCard } from "./referral-link";

export const metadata: Metadata = { title: "My Referrals" };

type Row = { id: string; number: number; service: string; city: string; status: string; channel: string; created_at: string; provider_name: string | null };

export default async function MyReferralsPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { org } = await requireCapability("refer", "/app/referrals");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_referrals", { p_org: org.id });
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="My Referrals"
        description="Every project your business shared and where it is now."
        action={
          <Button asChild>
            <Link href="/app/referrals/new">
              <Send aria-hidden /> Send Referral
            </Link>
          </Button>
        }
      />
      {sp.sent ? <FormMessage tone="success">Referral sent. BookedUp will confirm authorization with the homeowner and review it.</FormMessage> : null}
      <ReferralLinkCard orgId={org.id} />
      {!rows.length ? (
        <EmptyState title="No referrals yet">When a customer asks for something you don&apos;t do, send it here or share your link.</EmptyState>
      ) : (
        <Table head={["#", "Service", "City", "Status", "Provider", "Source", "Sent"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="tabular-nums text-muted">{r.number}</Td>
              <Td className="font-medium">{r.service}</Td>
              <Td>{r.city}</Td>
              <Td>
                <Badge tone={toneFor(r.status)}>{referralStatusLabel[r.status] ?? r.status}</Badge>
              </Td>
              <Td>{r.provider_name ?? "—"}</Td>
              <Td className="text-muted">{r.channel === "link" ? "Referral link" : "Sent by you"}</Td>
              <Td className="text-muted">{date(r.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
