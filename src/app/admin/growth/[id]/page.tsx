import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/shell";
import { Badge, EmptyState, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { setDeliveryValidation, setGrowthStatus } from "@/modules/admin/actions";
import { HEALTH, VALIDATION } from "@/modules/growth/progress";
import { GrowthAdminControls } from "@/modules/growth/admin-controls";
import { Select } from "@/components/ui/inputs";
import { assignmentStatusLabel, date, dateTime, toneFor } from "@/modules/format";

export const metadata: Metadata = { title: "Growth contract" };

type Delivery = {
  id: string;
  delivered_at: string;
  excluded: boolean;
  validation: string;
  audit_note: string | null;
  referrals: { id: string; number: number; qualified_at: string | null } | null;
  referral_assignments: { status: string } | null;
};

export default async function GrowthContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: p }, { data: d }] = await Promise.all([
    supabase.from("growth_contract_progress").select("*").eq("contract_id", id).maybeSingle(),
    supabase
      .from("growth_deliveries")
      .select("id, delivered_at, excluded, validation, audit_note, referrals(id, number, qualified_at), referral_assignments(status)")
      .eq("contract_id", id)
      .order("delivered_at"),
  ]);
  if (!p) notFound();
  const deliveries = (d ?? []) as unknown as Delivery[];

  return (
    <>
      <Link href="/admin/growth" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Growth Clients
      </Link>
      <PageHeader title={p.provider_name} description={`${date(p.start_date)} – ${date(p.deadline)}`} />
      <Flash sp={sp} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Delivered" value={`${p.delivered} / ${p.target}`} />
        <StatCard label="Remaining" value={p.remaining} />
        <StatCard label="Days left" value={p.days_left} />
        <StatCard label="Status" value={<Badge tone={toneFor(p.status)}>{String(p.status).replace("_", " ")}</Badge>} />
        <StatCard label="Health" value={<Badge tone={(HEALTH[p.health] ?? HEALTH.on_track).tone}>{(HEALTH[p.health] ?? HEALTH.on_track).label}</Badge>} />
        <StatCard label="Pace" value={`${p.current_per_month}/mo`} hint={`Expected ${p.expected_per_month}/mo`} />
        <StatCard label="Pending validation" value={p.pending_validation} />
        <StatCard label="Dispute / replacement" value={`${p.under_dispute} / ${p.replacement_required}`} />
      </div>
      <p className="m-0 text-sm text-muted">Only deliveries validated as qualified count toward the target.</p>
      {["active", "continuation_required"].includes(p.status) ? (
        <GrowthAdminControls orgId={p.provider_org_id} returnTo={`/admin/growth/${id}`} showLink={false} />
      ) : null}
      <form action={setGrowthStatus} className="flex flex-wrap gap-2">
        <input type="hidden" name="contractId" value={id} />
        {["active", "completed", "continuation_required", "cancelled"].map((s) => (
          <Button key={s} size="sm" variant={s === p.status ? "primary" : "secondary"} name="status" value={s}>
            {s.replace("_", " ")}
          </Button>
        ))}
      </form>
      <h2 className="text-lg font-semibold">Delivery audit</h2>
      {!deliveries.length ? (
        <EmptyState title="No deliveries yet">Referrals sent to this provider during the window are recorded here automatically.</EmptyState>
      ) : (
        <Table head={["Referral", "Sent", "Provider status", "Validation", "Update"]}>
          {deliveries.map((x) => (
            <tr key={x.id}>
              <Td>
                {x.referrals ? (
                  <Link href={`/admin/referrals/${x.referrals.id}`} className="text-primary hover:underline">
                    #{x.referrals.number}
                  </Link>
                ) : (
                  "—"
                )}
              </Td>
              <Td className="text-muted">{dateTime(x.delivered_at)}</Td>
              <Td>
                {x.referral_assignments ? (
                  <Badge tone={toneFor(x.referral_assignments.status)}>{assignmentStatusLabel[x.referral_assignments.status]}</Badge>
                ) : null}
              </Td>
              <Td>
                <Badge tone={(VALIDATION[x.validation] ?? VALIDATION.pending_validation).tone}>
                  {(VALIDATION[x.validation] ?? VALIDATION.pending_validation).label}
                </Badge>
              </Td>
              <Td>
                <form action={setDeliveryValidation} className="flex flex-wrap gap-2">
                  <input type="hidden" name="deliveryId" value={x.id} />
                  <input type="hidden" name="contractId" value={id} />
                  <Select name="validation" defaultValue={x.validation} aria-label="Validation" className="h-9 w-48">
                    {Object.entries(VALIDATION).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </Select>
                  <input
                    name="note"
                    defaultValue={x.audit_note ?? ""}
                    placeholder="Reason"
                    aria-label="Audit note"
                    className="h-9 w-40 rounded-xl border-2 border-line bg-background px-2 text-sm"
                  />
                  <Button size="sm" variant="secondary">Save</Button>
                </form>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
