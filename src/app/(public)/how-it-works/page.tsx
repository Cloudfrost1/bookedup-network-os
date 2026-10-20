import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorksPage() {
  return (
    <div className="mx-auto grid max-w-3xl gap-10 px-4 py-16">
      <div className="grid gap-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">How BookedUp Network works</h1>
        <p className="text-muted">BookedUp operates the network: we review every business and every referral before anything is shared.</p>
      </div>
      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">For businesses that refer projects</h2>
        <p className="text-muted">
          When a customer asks for a service you don&apos;t offer, send it to the network with their permission, or share your
          referral link so they can request it themselves. You can follow the status of every referral.
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">For businesses that receive projects</h2>
        <p className="text-muted">
          Approved providers receive projects that match their services and service areas. Customer contact details are shared
          only after you accept the project and the customer has authorized it.
        </p>
      </section>
      <section className="grid gap-2">
        <h2 className="text-xl font-semibold">What we never do</h2>
        <p className="text-muted">We don&apos;t sell customer contacts, and we don&apos;t send the same request to a list of competing businesses.</p>
      </section>
      <Button asChild size="lg" className="justify-self-start">
        <Link href="/signup">Join the Network</Link>
      </Button>
    </div>
  );
}
