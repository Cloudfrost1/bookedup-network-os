import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { Field, Input } from "@/components/ui/form";
import { Select, Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { createGrowthContract } from "@/modules/admin/actions";
import { date, toneFor } from "@/modules/format";

export const metadata: Metadata = { title: "Growth Clients" };

type Progress = {
  contract_id: string;
  provider_name: string;
  start_date: string;
  deadline: string;
  target: number;
  status: string;
  delivered: number;
  remaining: number;
  days_left: number;
};

export default async function GrowthPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: providers }, { data: settings }] = await Promise.all([
    supabase.from("growth_contract_progress").select("*").order("start_date", { ascending: false }),
    supabase.from("organizations").select("id, name, organization_capabilities(capability, status)").eq("status", "approved").order("name"),
    supabase.from("network_settings").select("growth_offer_text, growth_offer_approved").limit(1).maybeSingle(),
  ]);
  const rows = (data ?? []) as Progress[];
  const receivers = ((providers ?? []) as { id: string; name: string; organization_capabilities: { capability: string; status: string }[] }[]).filter(
    (p) => p.organization_capabilities.some((c) => c.capability === "receive" && c.status === "approved"),
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title="Growth Clients" description="Service contracts: qualified quote requests delivered inside a 90-day window." />
      <Flash sp={sp} />
      <Card className="text-sm">
        <p>
          Offer: <strong>{settings?.growth_offer_text ?? "—"}</strong>{" "}
          {settings?.growth_offer_approved ? <Badge tone="success">Approved</Badge> : <Badge tone="warning">Not approved for public use</Badge>}
        </p>
        <p className="mt-1 text-muted">
          A delivery counts only when the referral is qualified, the homeowner authorization is valid, the provider did not decline, and it was sent inside the window. Appointments or closed jobs are not promised.
        </p>
      </Card>
      {!rows.length ? (
        <EmptyState title="No Growth contracts yet" />
      ) : (
        <Table head={["Provider", "Progress", "Window", "Days left", "Status"]}>
          {rows.map((r) => {
            const elapsed = Math.min(1, Math.max(0, (Date.now() - new Date(r.start_date).getTime()) / (90 * 864e5)));
            const behind = r.status === "active" && r.delivered < r.target * elapsed * 0.8;
            return (
              <tr key={r.contract_id} className="hover:bg-surface">
                <Td>
                  <Link href={`/admin/growth/${r.contract_id}`} className="font-medium text-primary hover:underline">
                    {r.provider_name}
                  </Link>
                </Td>
                <Td>
                  <div className="grid gap-1">
                    <span className="tabular-nums">
                      {r.delivered} / {r.target}
                    </span>
                    <span className="h-1.5 w-32 overflow-hidden rounded-full bg-subtle">
                      <span className="block h-full bg-primary" style={{ width: `${Math.min(100, (r.delivered / r.target) * 100)}%` }} />
                    </span>
                  </div>
                </Td>
                <Td className="text-muted">
                  {date(r.start_date)} – {date(r.deadline)}
                </Td>
                <Td className="tabular-nums">{r.days_left}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={toneFor(r.status)}>{r.status.replace("_", " ")}</Badge>
                    {behind ? <Badge tone="danger">Behind pace</Badge> : null}
                  </span>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
      <Card>
        <form action={createGrowthContract} className="grid gap-3">
          <h2 className="font-semibold">New Growth contract</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="providerId" label="Provider">
              <Select id="providerId" name="providerId" required defaultValue="">
                <option value="">Select</option>
                {receivers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="start" label="Start date">
              <Input id="start" name="start" type="date" defaultValue={today} required />
            </Field>
            <Field id="target" label="Target (qualified requests)">
              <Input id="target" name="target" type="number" min={1} max={500} defaultValue={24} required />
            </Field>
          </div>
          <Input name="notes" placeholder="Notes (optional)" aria-label="Notes" maxLength={2000} />
          <Button size="sm" className="justify-self-start">Create contract</Button>
        </form>
      </Card>
    </>
  );
}
