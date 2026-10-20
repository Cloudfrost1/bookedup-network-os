import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/modules/network/org";
import { ReliabilityView, type Reliability } from "@/modules/provider/reliability-view";

export const metadata: Metadata = { title: "Reliability" };

export default async function ReliabilityPage() {
  const { org } = await requireOrg("/provider/reliability");
  const supabase = await createClient();
  const { data } = await supabase.rpc("provider_reliability", { p_org: org.id });
  return (
    <>
      <PageHeader
        title="Reliability history"
        description="Response time, attendance, commitments and verified feedback. This is what BookedUp looks at before sending you a project."
      />
      <ReliabilityView r={data as Reliability} />
    </>
  );
}
