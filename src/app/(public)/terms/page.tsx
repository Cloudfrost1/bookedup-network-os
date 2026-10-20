import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="mx-auto grid max-w-3xl gap-4 px-4 py-16">
      <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
        Draft. These terms are pending legal review before the network opens to the public.
      </p>
      <h1 className="text-3xl font-semibold">Terms of Use</h1>
      <p className="text-muted">
        Membership is free. There are no referral quotas and no exclusivity. BookedUp reviews businesses and referrals before
        approving them, and may suspend accounts that misuse customer information.
      </p>
    </article>
  );
}
