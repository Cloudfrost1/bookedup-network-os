import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { Select } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { updateGrowthReview } from "@/modules/admin/actions";
import { dateTime } from "@/modules/format";

export const metadata: Metadata = { title: "Growth Review requests" };

type Req = {
  id: string;
  org_id: string | null;
  source: string;
  name: string;
  company: string;
  email: string;
  phone: string | null;
  city: string | null;
  services: string | null;
  best_time: string | null;
  message: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

const STATUS: Record<string, { label: string; tone: "warning" | "purple" | "success" | "neutral" | "danger" }> = {
  new: { label: "New", tone: "warning" },
  contacted: { label: "Contacted", tone: "purple" },
  qualified: { label: "Qualified for Growth", tone: "success" },
  not_a_fit: { label: "Not a fit", tone: "danger" },
  closed: { label: "Closed", tone: "neutral" },
};

export default async function GrowthRequestsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("growth_review_requests").select("*").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as Req[];
  return (
    <>
      <Link href="/admin/growth" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Growth Clients
      </Link>
      <PageHeader
        title="Growth Review requests"
        description="Consultative sales: check capacity, cash, average ticket, close rate, cities and whether 24 qualified requests are realistic before offering Growth."
      />
      <Flash sp={sp} />
      {!rows.length ? (
        <EmptyState title="No requests yet">Requests from providers in the platform and from the public Growth page appear here.</EmptyState>
      ) : (
        <div className="grid gap-4">
          {rows.map((r) => {
            const st = STATUS[r.status] ?? STATUS.new;
            return (
              <Card key={r.id} className="grid gap-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="grid">
                    <span className="text-base font-extrabold">{r.company}</span>
                    <span className="text-muted">
                      {r.name} · {dateTime(r.created_at)} · {r.source === "platform" ? "From the platform" : "From the public page"}
                    </span>
                  </span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  <span>
                    <a href={`mailto:${r.email}`} className="text-primary hover:underline">{r.email}</a>
                    {r.phone ? (
                      <>
                        {" · "}
                        <a href={`tel:${r.phone}`} className="text-primary hover:underline">{r.phone}</a>
                      </>
                    ) : null}
                  </span>
                  <span className="text-muted">{[r.city, r.services].filter(Boolean).join(" · ") || "—"}</span>
                  {r.best_time ? <span className="text-muted">Best time: {r.best_time}</span> : null}
                  {r.org_id ? (
                    <Link href={`/admin/organizations/${r.org_id}`} className="font-semibold text-primary hover:underline">
                      Open organization
                    </Link>
                  ) : null}
                </div>
                {r.message ? <p className="m-0 rounded-xl bg-subtle px-3 py-2">{r.message}</p> : null}
                <form action={updateGrowthReview} className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <Select name="status" defaultValue={r.status} aria-label="Status" className="h-9 w-48">
                    {Object.entries(STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </Select>
                  <input
                    name="notes"
                    defaultValue={r.admin_notes ?? ""}
                    placeholder="Notes (ticket, capacity, close rate…)"
                    aria-label="Notes"
                    maxLength={2000}
                    className="h-9 min-w-0 flex-1 rounded-xl border-2 border-line bg-background px-3 text-sm"
                  />
                  <Button size="sm">Save</Button>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
