import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site";

export async function ReferralLinkCard({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("referral_code").eq("id", orgId).single();
  if (!data) return null;
  const link = `${await siteOrigin()}/r/${data.referral_code}`;
  return (
    <Card className="grid gap-3">
      <div className="grid gap-1">
        <h2 className="font-semibold">Your referral link</h2>
        <p className="text-sm text-muted">
          Send this link to a homeowner who needs a service you don&apos;t offer. They describe the project and authorize contact themselves.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-subtle px-3 py-2 text-sm">{link}</code>
        <CopyButton value={link} />
      </div>
    </Card>
  );
}
