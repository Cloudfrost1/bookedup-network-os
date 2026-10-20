import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto grid max-w-3xl gap-4 px-4 py-16">
      <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
        Draft. This policy is pending legal review before the network opens to the public.
      </p>
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="text-muted">
        BookedUp collects business information to operate the network and homeowner information only to route a project the
        homeowner asked about. Homeowner details are shared with a service provider only with authorization, and are never sold.
      </p>
      <p className="text-muted">Contact: privacy requests will be handled through the Support page once the pilot opens.</p>
    </article>
  );
}
