import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <>
      <PageHeader title="Support" description="Questions about your account, approval or a referral." />
      <Card className="grid gap-2 text-sm">
        <p>Reply to any e-mail from BookedUp, or contact your relationship manager.</p>
        <p className="text-muted">A support form inside the app arrives with the referrals release.</p>
      </Card>
    </>
  );
}
