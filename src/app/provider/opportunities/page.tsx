import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, EmptyState } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/modules/network/org";
import { assignmentStatusLabel, date, money, timelineLabel, toneFor } from "@/modules/format";
import { budgetLabel } from "@/modules/provider/labels";

export const metadata: Metadata = { title: "Opportunities" };

type Row = {
  assignment_id: string;
  referral_number: number;
  service: string;
  city: string;
  zip: string;
  timeline: string | null;
  budget_range: string | null;
  photos: number;
  status: string;
  assigned_at: string;
  estimated_value: number | null;
};

export default async function OpportunitiesPage() {
  const { org } = await requireCapability("receive", "/provider/opportunities");
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_my_opportunities_v2", { p_org: org.id });
  const rows = (data ?? []) as Row[];
  const fresh = rows.filter((r) => r.status === "offered").length;

  return (
    <>
      <PageHeader
        title="Opportunities"
        description={fresh ? `${fresh} new ${fresh === 1 ? "opportunity needs" : "opportunities need"} your answer.` : "Projects BookedUp sent to your business."}
      />
      {!rows.length ? (
        <EmptyState title="No opportunities yet">
          When BookedUp qualifies a project that matches your services and cities, it shows up here. Keep your services and service areas up to date in My Business.
        </EmptyState>
      ) : (
        <Table head={["#", "Service", "Location", "Timeline", "Budget", "Status", "Your estimate", "Received"]}>
          {rows.map((r) => (
            <tr key={r.assignment_id} className="hover:bg-surface">
              <Td className="tabular-nums text-muted">{r.referral_number}</Td>
              <Td>
                <Link href={`/provider/opportunities/${r.assignment_id}`} className="font-medium text-primary hover:underline">
                  {r.service}
                </Link>
              </Td>
              <Td>
                {r.city} {r.zip}
              </Td>
              <Td>{r.timeline ? timelineLabel[r.timeline] : "—"}</Td>
              <Td>
                {r.budget_range ? budgetLabel[r.budget_range] : "—"}
                {r.photos ? <span className="block text-xs text-muted">{r.photos} photo(s)</span> : null}
              </Td>
              <Td>
                <Badge tone={toneFor(r.status)}>{assignmentStatusLabel[r.status]}</Badge>
              </Td>
              <Td className="tabular-nums">{money(r.estimated_value)}</Td>
              <Td className="text-muted">{date(r.assigned_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
