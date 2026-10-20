import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Handshake, Lock, MapPin, Send, ShieldCheck, UserRound } from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "BookedUp Partner Circle · Free Local Referral Network · Orlando, FL" },
  description:
    "A free network of local home-service businesses in Central Florida. Refer work you don't do. Be considered for work you do. No fees, no exclusivity, no quotas.",
};

function Cta({ children, href = "/signup", ghost = false }: { children: React.ReactNode; href?: string; ghost?: boolean }) {
  return (
    <Link href={href} className={ghost ? "pub-btn ghost" : "pub-btn"}>
      {children}
    </Link>
  );
}

/** Two-way flow panel: what comes to you, what goes out from you. */
function FlowPanel() {
  return (
    <div className="pub-stack" role="img" aria-label="Opportunities flow both ways through BookedUp">
      <div className="panel pub-dark grid gap-3 p-5 sm:p-6">
        <span className="pub-flow-label">COMING YOUR WAY</span>
        <div className="pub-fcard">
          <span className="pub-ftag">BookedUp</span>
          <b>Flooring request in your area</b>
          <small>A homeowner needs new tile</small>
        </div>
        <span className="pub-fconn">If it&apos;s a fit</span>
        <div className="pub-fcard hot">
          <span className="pub-ftag">Your business</span>
          <b>Considered for an introduction</b>
          <small>Based on service, area and availability</small>
        </div>
        <span className="pub-flow-label mt-3">GOING OUT FROM YOU</span>
        <div className="pub-fcard">
          <span className="pub-ftag out">Outside your scope</span>
          <b>Your customer wants a full remodel</b>
          <small>Sent with their permission</small>
        </div>
        <span className="pub-fconn">BookedUp looks for a match</span>
        <div className="pub-fcard">
          <span className="pub-ftag ok">Connected</span>
          <b>Local remodeling contractor</b>
          <small>When one is available</small>
        </div>
      </div>
    </div>
  );
}

const steps = [
  { icon: UserRound, t: "Apply", d: "Tell us your services and service area. We review every business." },
  { icon: Send, t: "Refer", d: "Send a request you don't handle — only with the homeowner's permission." },
  { icon: Handshake, t: "Get introduced", d: "When a request fits your trade and area, you may be considered." },
];

const trust = [
  { icon: Lock, t: "Homeowner permission first", d: "Contact details are never shared without it." },
  { icon: BadgeCheck, t: "Every business is reviewed", d: "Badges are earned with verified documents and track record." },
  { icon: Handshake, t: "Keep your partners", d: "No exclusivity. No referral quotas." },
  { icon: ShieldCheck, t: "No empty promises", d: "We don't guarantee leads, projects or revenue." },
];

const faq = [
  {
    q: "Is it really free?",
    a: "Yes. No setup or monthly fee. BookedUp sells separate growth services to contractors — they're optional.",
  },
  {
    q: "Will you send me customers?",
    a: "You may be considered when a request fits your service, area and availability. Volume isn't guaranteed.",
  },
  { q: "Do I have to send referrals?", a: "No. There are no quotas. Refer only when it helps your customer." },
  {
    q: "Does BookedUp guarantee a contractor's work?",
    a: "No. Providers are independent businesses. Verify license, insurance and references before hiring.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* hero */}
      <section className="wrap grid items-center gap-14 pt-12 pb-14 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="grid justify-items-start gap-6">
          <span className="pub-kicker">Free local referral network · Orlando, FL</span>
          <h1 className="text-[40px] sm:text-[52px] lg:text-[56px]">
            More local connections.
            <br />
            <span className="hl">More opportunities for your business.</span>
          </h1>
          <p className="m-0 max-w-xl text-[18px] font-bold leading-[1.6]">
            Join a free network of local home-service businesses that help each other connect with new customers.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="pub-softtag">No fees</span>
            <span className="pub-softtag">No exclusivity</span>
            <span className="pub-softtag">No referral quotas</span>
          </div>
          <Cta>Become a Free Local Partner →</Cta>
          <p className="pub-mono-note m-0 max-w-xl">Free to join. Referral opportunities depend on availability and fit. No guaranteed volume.</p>
        </div>
        <FlowPanel />
      </section>

      {/* how it works */}
      <section id="how-it-works" className="pub-sec wrap">
        <div className="pub-head">
          <h2>
            Simple by <span className="hl">design.</span>
          </h2>
        </div>
        <ol className="grid gap-6 p-0 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.t} className="pub-card grid list-none content-start gap-4">
              <div className="flex items-center justify-between">
                <span className="pub-icon">
                  <s.icon aria-hidden className="size-5" />
                </span>
                <span className="pub-num">0{i + 1}</span>
              </div>
              <h3 className="text-[24px]">{s.t}</h3>
              <p className="m-0 text-[15px] text-[var(--ink-soft)]">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* trust */}
      <section id="benefits" className="pub-sec wrap">
        <div className="pub-dark grid gap-8 px-6 py-12 sm:px-10">
          <div className="grid gap-3">
            <span className="pub-flow-label">YOUR CUSTOMERS. YOUR REPUTATION.</span>
            <h2 className="text-[32px] sm:text-[40px]">Built on trust.</h2>
          </div>
          <ul className="grid gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {trust.map((x) => (
              <li key={x.t} className="grid list-none content-start gap-2 rounded-[14px] border-[1.5px] border-[rgba(247,244,254,.18)] bg-[rgba(247,244,254,.05)] p-5">
                <x.icon aria-hidden className="size-6 text-[var(--accent-glow)]" />
                <p className="m-0 font-extrabold">{x.t}</p>
                <p className="m-0 text-[14px] text-[rgba(247,244,254,.75)]">{x.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* price + area */}
      <section id="who-its-for" className="pub-sec wrap grid gap-6 md:grid-cols-2">
        <div className="pub-card grid content-start gap-3 !p-8">
          <span className="pub-eyebrow">WHAT DOES IT COST?</span>
          <p className="pub-price m-0">$0.</p>
          <p className="m-0 text-[17px] font-bold">No setup fee. No monthly fee. No obligation.</p>
        </div>
        <div className="pub-card grid content-start gap-4 !p-8">
          <span className="pub-eyebrow">STARTING IN CENTRAL FLORIDA</span>
          <ul className="flex flex-wrap gap-2 p-0">
            {["Orlando", "Kissimmee", "Sanford", "Winter Park", "Altamonte Springs"].map((c) => (
              <li key={c} className="pub-pill list-none !shadow-none">
                <MapPin aria-hidden className="size-4 text-[var(--accent)]" /> {c}
              </li>
            ))}
          </ul>
          <p className="m-0 text-[15px] text-[var(--ink-soft)]">Nearby areas are welcome to apply.</p>
        </div>
      </section>

      {/* faq */}
      <section id="faq" className="pub-sec wrap">
        <div className="pub-head">
          <h2>Questions</h2>
        </div>
        <div className="pub-faq mx-auto grid max-w-3xl gap-3">
          {faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* final cta */}
      <section className="pub-sec wrap">
        <div className="pub-dark grid justify-items-center gap-6 px-6 py-14 text-center">
          <h2 className="max-w-2xl text-[34px] sm:text-[48px]">
            Good business comes from <span className="text-[var(--accent-glow)]">good connections.</span>
          </h2>
          <Cta>
            Become a Free Local Partner <ArrowRight aria-hidden className="size-5" />
          </Cta>
          <p className="m-0 text-[13px] text-[rgba(247,244,254,.65)]">Free to join · Applications reviewed for fit · No guaranteed volume</p>
        </div>
      </section>
    </>
  );
}
