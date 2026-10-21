import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Hammer, Inbox, Send, Share2 } from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "BookedUp Network · Free Local Referral Network · Orlando, FL" },
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

export default function HomePage() {
  return (
    <>
      {/* 01 · hero */}
      <section className="wrap grid items-center gap-14 pt-12 pb-14 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="grid justify-items-start gap-6">
          <h1 className="text-[40px] sm:text-[52px] lg:text-[56px]">
            Stop Losing Opportunities <span className="hl">Outside Your Scope.</span>
          </h1>
          <p className="m-0 max-w-xl text-[19px] font-bold leading-[1.5]">
            Your customers need more than one service. Your business doesn&apos;t have to provide them all.
          </p>
          <p className="pub-lead m-0 max-w-xl">Join a free network of local home-service businesses that share relevant opportunities.</p>
          <div className="flex flex-wrap gap-2">
            <span className="pub-softtag">Free to join</span>
            <span className="pub-softtag">No exclusivity</span>
            <span className="pub-softtag">No referral quotas</span>
          </div>
          <Cta>Become a Free Local Partner →</Cta>
        </div>
        <FlowPanel />
      </section>

      {/* 02 · how it works */}
      <section id="how-it-works" className="pub-sec wrap">
        <div className="pub-head">
          <h2>
            Refer work. <span className="hl">Get considered for work.</span>
          </h2>
        </div>
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <article className="pub-card grid content-start gap-4">
            <span className="pub-icon">
              <Send aria-hidden className="size-5" />
            </span>
            <h3 className="text-[26px]">You Refer</h3>
            <p className="m-0 text-[16px] text-[var(--ink-soft)]">Your customer needs a service you don&apos;t provide.</p>
          </article>
          <article className="pub-card grid content-start gap-4">
            <span className="pub-icon">
              <Inbox aria-hidden className="size-5" />
            </span>
            <h3 className="text-[26px]">You May Receive</h3>
            <p className="m-0 text-[16px] text-[var(--ink-soft)]">Another partner has a request that fits your business.</p>
          </article>
        </div>
      </section>


      {/* two ways in: refer for free, or apply to receive */}
      <section id="join" className="pub-sec wrap">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <article className="pub-card grid content-start gap-4">
            <span className="pub-icon">
              <Share2 aria-hidden className="size-5" />
            </span>
            <span className="pub-flow-label !text-[var(--accent)]">FOR BUSINESSES THAT GET OUT-OF-SCOPE REQUESTS</span>
            <h3 className="text-[24px]">Turn projects you can&apos;t serve into trusted introductions.</h3>
            <Cta>Join the Network — Free</Cta>
          </article>
          <article className="pub-card grid content-start gap-4">
            <span className="pub-icon">
              <Hammer aria-hidden className="size-5" />
            </span>
            <span className="pub-flow-label !text-[var(--accent)]">FOR REMODELING COMPANIES THAT WANT TO GROW</span>
            <h3 className="text-[24px]">Looking for qualified estimate requests?</h3>
            <p className="m-0 text-[15px] text-[var(--ink-soft)]">Free application and verification. Approval does not guarantee project volume.</p>
            <Cta href="/signup?as=provider" ghost>
              Apply as a Service Provider
            </Cta>
          </article>
        </div>
      </section>

      {/* 03 · example */}
      <section id="example" className="pub-sec wrap">
        <div className="pub-dark mx-auto grid max-w-4xl gap-5 px-6 py-10 sm:px-12 sm:py-14">
          <span className="pub-flow-label">EXAMPLE</span>
          <h2 className="text-[30px] sm:text-[40px]">You&apos;re a flooring contractor.</h2>
          <ol className="grid gap-3 p-0">
            {[
              "Your customer needs a full bathroom remodel. You don't offer that service.",
              "With their permission, send the request to BookedUp. We'll look for a suitable remodeling contractor.",
              "Next time another business has a flooring request, your company may be considered.",
            ].map((t, i) => (
              <li key={i} className="flex list-none gap-4 rounded-[14px] border-[1.5px] border-[rgba(247,244,254,.18)] bg-[rgba(247,244,254,.05)] p-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] font-mono text-sm font-bold text-white">{i + 1}</span>
                <span className="text-[16px] leading-[1.6] text-[rgba(247,244,254,.9)]">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 04 · no commitment */}
      <section id="no-risk" className="pub-sec wrap">
        <div className="pub-head !mb-0">
          <h2>
            Keep Your Partners. <span className="hl">Join Ours Too.</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="pub-softtag">No fees.</span>
            <span className="pub-softtag">No exclusivity.</span>
            <span className="pub-softtag">No referral quotas.</span>
            <span className="pub-softtag">No guaranteed lead volume.</span>
          </div>
          <p className="pub-note m-0">BookedUp also offers separate optional paid growth services.</p>
        </div>
      </section>


      {/* Growth (no price on the network homepage) */}
      <section id="growth" className="pub-sec wrap">
        <div className="pub-dark mx-auto grid max-w-4xl gap-4 px-6 py-10 sm:px-12">
          <span className="pub-flow-label">BOOKEDUP GROWTH</span>
          <h2 className="text-[28px] sm:text-[36px]">Need a more predictable pipeline?</h2>
          <p className="m-0 max-w-2xl text-[17px] text-[rgba(247,244,254,.85)]">
            BookedUp Growth combines qualified estimate requests with the digital infrastructure your company needs to convert them.
          </p>
          <Link href="/growth" className="pub-btn justify-self-start">
            Learn about BookedUp Growth <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>

      {/* 05 · final cta */}
      <section className="pub-sec wrap">
        <div className="pub-dark grid justify-items-center gap-6 px-6 py-14 text-center">
          <h2 className="max-w-2xl text-[34px] sm:text-[48px]">
            Good Business Comes From <span className="text-[var(--accent-glow)]">Good Connections.</span>
          </h2>
          <p className="m-0 text-[17px] text-[rgba(247,244,254,.85)]">Join the BookedUp Network for free.</p>
          <Cta>Become a Free Local Partner →</Cta>
        </div>
      </section>
    </>
  );
}
