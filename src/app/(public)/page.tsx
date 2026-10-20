import Link from "next/link";
import { ArrowRight, Ban, Handshake, ListChecks, MapPin, Send, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  { icon: UserRound, title: "Create Your Business Profile", body: "Tell us what you do, where you work and which requests you usually turn down." },
  { icon: Users, title: "Connect With Local Professionals", body: "Find complementary home-service businesses in the Orlando area." },
  { icon: Send, title: "Share and Receive Opportunities", body: "Refer projects outside your scope and receive projects that match your services." },
];

const benefits = [
  { icon: Handshake, title: "Free to Join" },
  { icon: Ban, title: "No Referral Quotas" },
  { icon: ListChecks, title: "No Exclusivity" },
  { icon: MapPin, title: "Local Business Connections" },
  { icon: Send, title: "Simple Referral Tracking" },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:py-24">
          <p className="text-sm font-medium text-primary">Orlando · Kissimmee · Sanford</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">Turn Missed Jobs Into Better Connections.</h1>
          <p className="max-w-2xl text-lg text-muted">
            Join a professional network of local home-service businesses. Refer projects outside your scope and connect
            with qualified service providers.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Join the Network <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/how-it-works">See how it works</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-semibold sm:text-3xl">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="grid content-start gap-3 rounded-xl border border-border p-5">
              <span className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
                  <s.icon aria-hidden className="size-4" />
                </span>
                <span className="font-mono text-xs text-muted">Step {i + 1}</span>
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-primary-deep text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14">
          <h2 className="text-2xl font-semibold sm:text-3xl">Built for local businesses</h2>
          <ul className="grid gap-3 sm:grid-cols-5">
            {benefits.map((b) => (
              <li key={b.title} className="flex items-center gap-3 rounded-lg bg-white/5 px-4 py-3 text-sm">
                <b.icon aria-hidden className="size-4 text-primary-soft" />
                {b.title}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
