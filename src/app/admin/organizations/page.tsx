import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { Input } from "@/components/ui/form";
import { Checkbox, Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { createOrganizationAdmin } from "@/modules/admin/actions";
import { date, toneFor } from "@/modules/format";

export const metadata: Metadata = { title: "Organizations" };

type Row = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  verification: string;
  created_at: string;
  organization_capabilities: { capability: string; status: string }[];
  organization_followups: { next_followup_at: string | null } | null;
};

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; followup?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from("organizations")
    .select("id, name, city, status, verification, created_at, organization_capabilities(capability, status), organization_followups(next_followup_at)")
    .order("created_at", { ascending: false })
    .limit(300);
  q = sp.status === "deleted" ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
  if (sp.q) q = q.ilike("name", `%${sp.q.replace(/[%_,]/g, "").slice(0, 80)}%`);
  if (sp.status && ["pending_review", "approved", "suspended", "rejected"].includes(sp.status)) q = q.eq("status", sp.status);
  const { data } = await q;
  let rows = (data ?? []) as unknown as Row[];
  if (sp.followup === "due") {
    const now = Date.now();
    rows = rows.filter((r) => r.organization_followups?.next_followup_at && new Date(r.organization_followups.next_followup_at).getTime() <= now);
  }
  const cap = (r: Row, c: string) => r.organization_capabilities.find((x) => x.capability === c)?.status;

  return (
    <>
      <PageHeader title="Organizations" description="Every business in the network, its access and follow-up." />
      <Flash sp={sp} />
      <form action="/admin/organizations" className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
        <Input name="q" placeholder="Search by name" aria-label="Search by name" defaultValue={sp.q ?? ""} />
        <select name="status" aria-label="Status" defaultValue={sp.status ?? ""} className="h-11 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="">All statuses</option>
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
          <option value="deleted">Deleted</option>
        </select>
        <Button variant="secondary">Filter</Button>
      </form>
      {!rows.length ? (
        <EmptyState title="No organizations found" />
      ) : (
        <Table head={["Business", "City", "Status", "Refer", "Receive", "Verified", "Follow-up", "Joined"]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-surface">
              <Td>
                <Link href={`/admin/organizations/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.name}
                </Link>
              </Td>
              <Td>{r.city ?? "—"}</Td>
              <Td>
                <Badge tone={toneFor(r.status)}>{r.status.replace("_", " ")}</Badge>
              </Td>
              <Td>{cap(r, "refer") ? <Badge tone={toneFor(cap(r, "refer")!)}>{cap(r, "refer")}</Badge> : "—"}</Td>
              <Td>{cap(r, "receive") ? <Badge tone={toneFor(cap(r, "receive")!)}>{cap(r, "receive")}</Badge> : "—"}</Td>
              <Td>{r.verification === "verified" ? <Badge tone="purple">Verified</Badge> : <span className="text-muted">No</span>}</Td>
              <Td className="text-muted">{date(r.organization_followups?.next_followup_at)}</Td>
              <Td className="text-muted">{date(r.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
      <Card className="grid gap-3">
        <h2 className="font-semibold">Add a business manually</h2>
        <p className="text-sm text-muted">For businesses onboarded by the BookedUp team. They start in review; approve them on the next screen.</p>
        <form action={createOrganizationAdmin} className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input name="name" placeholder="Business name" aria-label="Business name" required />
            <Input name="email" type="email" placeholder="Business email" aria-label="Business email" />
            <Input name="phone" placeholder="Business phone" aria-label="Business phone" />
            <div className="grid grid-cols-[1fr_72px_100px] gap-2">
              <Input name="city" placeholder="City" aria-label="City" />
              <Input name="state" defaultValue="FL" maxLength={2} aria-label="State" />
              <Input name="zip" placeholder="ZIP" maxLength={5} aria-label="ZIP" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Checkbox name="refer" label="Wants to refer" />
            <Checkbox name="receive" label="Wants to receive" />
          </div>
          <Button size="sm" className="justify-self-start">Create business</Button>
        </form>
      </Card>
    </>
  );
}
