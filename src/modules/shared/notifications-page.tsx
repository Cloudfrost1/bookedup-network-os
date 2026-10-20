import Link from "next/link";
import { PageHeader } from "@/components/layout/shell";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { markNotificationsRead } from "@/modules/referrals/actions";
import { dateTime } from "@/modules/format";


export default async function NotificationsPage() {
  await requireUser("/app");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, link, read_at, created_at")
    .eq("for_admins", false)
    .order("created_at", { ascending: false })
    .limit(100);
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
        <EmptyState title="Nothing new">Updates about your referrals and opportunities appear here.</EmptyState>
      ) : (
        <Card className="divide-y divide-border p-0">
          {rows.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                {!n.read_at ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                {n.link ? (
                  <Link href={n.link} className="truncate hover:text-primary">
                    {n.title}
                  </Link>
                ) : (
                  <span className="truncate">{n.title}</span>
                )}
              </span>
              <span className="shrink-0 text-muted">{dateTime(n.created_at)}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
