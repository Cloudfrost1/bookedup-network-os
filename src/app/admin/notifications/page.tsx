import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { markNotificationsRead } from "@/modules/referrals/actions";
import { dateTime } from "@/modules/format";

export const metadata: Metadata = { title: "Admin notifications" };

export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, link, read_at, created_at")
    .eq("for_admins", true)
    .order("created_at", { ascending: false })
    .limit(150);
  const rows = data ?? [];
  return (
    <>
      <PageHeader
        title="Notifications"
        action={
          rows.some((r) => !r.read_at) ? (
            <form action={markNotificationsRead}>
              <Button variant="secondary" size="sm">Mark all as read</Button>
            </form>
          ) : null
        }
      />
      {!rows.length ? (
        <EmptyState title="Nothing new" />
      ) : (
        <Card className="divide-y divide-border p-0">
          {rows.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {!n.read_at ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                {n.link ? <Link href={n.link} className="truncate hover:text-primary">{n.title}</Link> : <span className="truncate">{n.title}</span>}
              </span>
              <span className="shrink-0 text-muted">{dateTime(n.created_at)}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
