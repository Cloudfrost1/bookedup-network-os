import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowDown,
  ArrowRight,
  Brush,
  CheckCircle2,
  Droplets,
  Hammer,
  HeartHandshake,
  KeyRound,
  Layers,
  LayoutGrid,
  MapPin,
  Network,
  Paintbrush,
  Ruler,
  Sparkles,
  SquareStack,
  Wrench,
} from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "BookedUp Partner Circle · Free Local Referral Network · Orlando, FL" },
  description:
    "Join a free network of local home-service businesses that help each other connect homeowners with the right professionals. No fees, no exclusivity, no referral quotas.",
};

function Cta({ children, href = "/signup", ghost = false }: { children: React.ReactNode; href?: string; ghost?: boolean }) {
  return (
    <Link href={href} className={ghost ? "pub-btn ghost" : "pub-btn"}>
      {children}
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="pub-eyebrow">{children}</span>;
}

/* ---------------------------------------------------------------- 01 hero */

const comingIn = [
  { t: "A Local Business Receives a Flooring Request", d: "A homeowner needs new tile installed." },
  { t: "BookedUp Reviews the Request", d: "We look for businesses that match the service, location, and project needs." },
  { t: "Your Flooring Business May Be Considered", d: "When there's a suitable opportunity and your company is a fit." },
];
const goingOut = [
  { t: "Your Customer Needs a Full Bathroom Remodel", d: "You handle flooring, but not complete bathroom renovations." },
  { t: "You Share the Request With Permission", d: "The homeowner agrees to be contacted about the project." },
  { t: "BookedUp Looks for a Suitable Remodeling Contractor", d: "We help coordinate an introduction when a compatible provider is available." },
];

function Flow({ label, steps }: { label: string; steps: { t: string; d: string }[] }) {
  return (
    <div className="pub-flow">
      <span className="pub-flow-label">{label}</span>
      {steps.map((s, i) => (
        <div key={s.t} className="grid gap-2">
          <div className="pub-flow-step">
            <b>{s.t}</b>
            <span>{s.d}</span>
          </div>
          {i < steps.length - 1 ? (
            <span className="pub-flow-arrow" aria-hidden>
              ↓
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Hero() {
  return (
    <section className="wrap grid items-start gap-12 pt-14 pb-10 sm:pt-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="grid justify-items-start gap-6">
        <span className="pub-pill">
          <span className="dot" aria-hidden /> FREE LOCAL REFERRAL NETWORK · ORLANDO, FL
        </span>
        <h1 className="text-[40px] sm:text-[54px] lg:text-[60px]">
          Stop Losing Opportunities <span className="hl">Outside Your Scope.</span>
        </h1>
        <p className="pub-lead m-0 font-bold text-[var(--ink)]">Your customers need more than one service. Your business doesn&apos;t have to provide them all.</p>
        <p className="pub-lead m-0 max-w-xl">
          Join a free network of local home-service businesses that help each other connect homeowners with the right professionals — and
          discover opportunities that match their own services.
        </p>
        <div className="pub-tags">
          <span className="pub-tag">No fees</span>
          <span className="pub-tag">No exclusivity</span>
          <span className="pub-tag">No referral quotas</span>
        </div>
        <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
          <Cta>
            Become a Free Local Partner <ArrowRight aria-hidden className="size-5" />
          </Cta>
          <Cta href="#how-it-works" ghost>
            See How It Works <ArrowDown aria-hidden className="size-5" />
          </Cta>
        </div>
        <p className="pub-note m-0">Free to join. Referral opportunities depend on availability and fit. No guaranteed volume.</p>
      </div>

      <div className="pub-dark grid gap-6 p-5 sm:p-7" role="img" aria-label="How opportunities flow in both directions through BookedUp">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Flow label="COMING YOUR WAY" steps={comingIn} />
          <Flow label="GOING OUT FROM YOU" steps={goingOut} />
        </div>
        <p className="m-0 text-center text-[17px] font-extrabold">One network. Opportunities can flow both ways.</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 02 problem */

function Problem() {
  const chain = [
    "A flooring installation turns into a bathroom renovation.",
    "A plumbing repair reveals the need for new cabinets.",
    "A painting project leads to new flooring.",
    "A property manager needs a reliable specialist for a job their usual contractor can't handle.",
  ];
  return (
    <section className="pub-sec wrap">
      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="pub-head !mb-2">
          <Eyebrow>WHY BOOKEDUP EXISTS</Eyebrow>
          <h2>
            Your Next Customer Could Come From <span className="hl">Another Local Business.</span>
          </h2>
          <p>Think about how many homeowners need more than one contractor.</p>
        </div>
        <ul className="grid gap-3 p-0 sm:grid-cols-2">
          {chain.map((c) => (
            <li key={c} className="pub-card flat list-none text-[15px] font-semibold">
              {c}
            </li>
          ))}
        </ul>
        <p className="pub-lead m-0 text-center">These opportunities already exist.</p>
        <div className="pub-callout text-center">But the right businesses aren&apos;t always connected when the opportunity comes up.</div>
        <p className="pub-lead m-0">And when a customer asks for something outside your scope, you usually have three options:</p>
        <ul className="pub-list">
          <li>Turn down the request.</li>
          <li>Spend time searching for someone who can handle it.</li>
          <li>Refer someone you already know — if they&apos;re available and a good fit.</li>
        </ul>
        <p className="m-0 text-[24px] font-extrabold">
          BookedUp gives you <span className="hl">another option.</span>
        </p>
        <p className="pub-lead m-0">
          Keep your existing partners. Keep doing what you do best. And when you need another professional connection, our network is here to
          help.
        </p>
        <div>
          <Cta>
            Join the Free Network <ArrowRight aria-hidden className="size-5" />
          </Cta>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 03 solution */

function Solution() {
  const pillars = [
    { n: "01", icon: HeartHandshake, t: "Help Customers Beyond Your Scope", d: "Be the business that has a helpful next step, even when you don't offer the service yourself." },
    { n: "02", icon: Sparkles, t: "Get Discovered for the Work You Do", d: "Let us know your services, coverage area, and project preferences so we can evaluate relevant opportunities." },
    { n: "03", icon: Network, t: "Strengthen Your Local Network", d: "Build relationships with complementary professionals without having to manage every connection yourself." },
  ];
  return (
    <section className="pub-sec wrap">
      <div className="pub-head">
        <h2>
          Refer Work. Discover Work. <span className="hl">Build Better Connections.</span>
        </h2>
        <p>BookedUp Partner Circle connects complementary home-service businesses across Central Florida.</p>
      </div>
      <div className="mx-auto mb-10 grid max-w-3xl gap-3 text-center text-[17px] text-[var(--ink-soft)]">
        <p className="m-0">When a customer needs a service you don&apos;t provide, you can submit a referral.</p>
        <p className="m-0">When another partner has a request that matches your services, your business may be considered for an introduction.</p>
        <div className="pub-tags mt-2 justify-center">
          <span className="pub-tag">No pressure to send a certain number of referrals.</span>
          <span className="pub-tag">No requirement to stop working with your existing contractors.</span>
          <span className="pub-tag">No membership fee.</span>
        </div>
        <p className="pub-strong m-0 mt-2">Just a more organized way to connect local businesses around real homeowner needs.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {pillars.map((p) => (
          <article key={p.n} className="pub-card grid content-start gap-4">
            <div className="flex items-center justify-between">
              <span className="pub-icon">
                <p.icon aria-hidden className="size-5" />
              </span>
              <span className="pub-num">{p.n}</span>
            </div>
            <h3 className="text-[22px]">{p.t}</h3>
            <p className="m-0 text-[15px] text-[var(--ink-soft)]">{p.d}</p>
          </article>
        ))}
      </div>
      <div className="mt-10 flex justify-center">
        <Cta>
          Become a Free Partner <ArrowRight aria-hidden className="size-5" />
        </Cta>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 04 how it works */

function HowItWorks() {
  return (
    <section id="how-it-works" className="pub-sec wrap">
      <div className="pub-head">
        <Eyebrow>SIMPLE BY DESIGN</Eyebrow>
        <h2>
          Four Steps. <span className="hl">One Better-Connected Business.</span>
        </h2>
      </div>
      <ol className="grid gap-6 p-0 md:grid-cols-2">
        <li className="pub-card grid list-none content-start gap-3">
          <span className="pub-num justify-self-start">01.</span>
          <h3 className="text-[22px]">Tell Us About Your Business</h3>
          <p className="m-0 text-[15px] text-[var(--ink-soft)]">Share your services, service area, and the types of projects your company handles.</p>
          <p className="m-0 text-[15px] text-[var(--ink-soft)]">We&apos;ll review your application to understand where your business may fit within the network.</p>
        </li>
        <li className="pub-card grid list-none content-start gap-3">
          <span className="pub-num justify-self-start">02.</span>
          <h3 className="text-[22px]">Let Us Know What You&apos;re Looking For</h3>
          <p className="m-0 text-[15px] text-[var(--ink-soft)]">
            Tell us which projects you&apos;re accepting and which services your customers commonly ask for that you don&apos;t provide.
          </p>
          <p className="m-0 text-[15px] text-[var(--ink-soft)]">
            This helps us understand how your company could participate on both sides of the referral network.
          </p>
        </li>
        <li className="pub-card grid list-none content-start gap-3">
          <span className="pub-num justify-self-start">03.</span>
          <h3 className="text-[22px]">Share or Receive Relevant Opportunities</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] bg-[var(--accent-tint)] p-4">
              <p className="m-0 font-extrabold">Need to refer a project?</p>
              <p className="m-0 mt-1 text-[14px] text-[var(--ink-soft)]">
                With the homeowner&apos;s permission, send us the request. We&apos;ll review it and look for a suitable provider.
              </p>
            </div>
            <div className="rounded-[14px] bg-[var(--accent-tint)] p-4">
              <p className="m-0 font-extrabold">Looking for more projects?</p>
              <p className="m-0 mt-1 text-[14px] text-[var(--ink-soft)]">
                When a compatible request enters the network, your business may be considered for an introduction.
              </p>
            </div>
          </div>
        </li>
        <li className="pub-card grid list-none content-start gap-3">
          <span className="pub-num justify-self-start">04.</span>
          <h3 className="text-[22px]">Stay Connected</h3>
          <p className="m-0 text-[15px] text-[var(--ink-soft)]">BookedUp helps coordinate relevant introductions and keeps referral information organized.</p>
          <p className="m-0 text-[15px] text-[var(--ink-soft)]">
            You remain responsible for deciding which opportunities to pursue and which professionals to work with.
          </p>
        </li>
      </ol>
      <p className="mt-10 mb-0 text-center text-[18px] font-extrabold">
        No complicated software to learn. No referral quotas. Just useful local connections.
      </p>
      <div className="mt-8 flex justify-center">
        <Cta>
          Join the Partner Circle — Free <ArrowRight aria-hidden className="size-5" />
        </Cta>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 05 two-way */

function TwoWay() {
  return (
    <section className="pub-sec wrap">
      <div className="pub-head">
        <Eyebrow>A NETWORK THAT WORKS BOTH WAYS</Eyebrow>
        <h2>
          You Can Be the One Referring Today — <span className="hl">and the Right Fit Tomorrow.</span>
        </h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="pub-card grid content-start gap-3">
          <span className="pub-flow-label !text-[var(--accent-deep)]">WHEN A PROJECT IS OUTSIDE YOUR SCOPE</span>
          <h3 className="text-[24px]">Don&apos;t Leave Your Customer Without a Next Step.</h3>
          <div className="grid gap-2 text-[15px] text-[var(--ink-soft)]">
            <p className="m-0">A homeowner calls your flooring company about installing tile.</p>
            <p className="m-0">During the conversation, they mention wanting to renovate the entire bathroom.</p>
            <p className="m-0">You don&apos;t handle full bathroom renovations.</p>
            <p className="m-0">
              Instead of simply saying, &quot;We don&apos;t do that,&quot; you can ask whether they&apos;d like help finding a remodeling contractor.
            </p>
            <p className="m-0">If they agree, you submit the request to BookedUp.</p>
            <p className="m-0">We review the details and look for a suitable business.</p>
          </div>
          <p className="m-0 mt-2 flex gap-2 font-extrabold">
            <CheckCircle2 aria-hidden className="mt-1 size-5 shrink-0 text-[var(--accent)]" />
            You helped your customer without taking on work you don&apos;t do.
          </p>
        </article>
        <article className="pub-dark grid content-start gap-3 p-6">
          <span className="pub-flow-label">WHEN AN OPPORTUNITY MATCHES YOUR SERVICES</span>
          <h3 className="text-[24px]">Be Considered for Work That Fits Your Business.</h3>
          <div className="grid gap-2 text-[15px] text-[rgba(247,244,254,.8)]">
            <p className="m-0">Another local company receives a request for flooring installation.</p>
            <p className="m-0">They don&apos;t offer that service.</p>
            <p className="m-0">The homeowner agrees to an introduction.</p>
            <p className="m-0">BookedUp reviews the project and identifies potential providers based on service, location, and available information.</p>
            <p className="m-0">If your business is a suitable fit, you may be contacted.</p>
          </div>
          <p className="m-0 mt-2 flex gap-2 font-extrabold">
            <CheckCircle2 aria-hidden className="mt-1 size-5 shrink-0 text-[var(--accent-glow)]" />
            That&apos;s the idea: local businesses helping each other find the right work.
          </p>
        </article>
      </div>
      <p className="pub-note mt-6 mb-0 text-center italic">Illustrative examples. Referrals, matches, contracts, and completed projects are not guaranteed.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- 06 who should join */

const trades = [
  { icon: Layers, t: "Flooring & Tile Contractors", d: "Flooring installation, tile work, bathroom floors, and related projects." },
  { icon: Droplets, t: "Plumbing Companies", d: "Residential plumbing, repairs, installations, and bathroom-related services." },
  { icon: SquareStack, t: "Shower Glass Installers", d: "Shower enclosures, glass doors, and bathroom finishing work." },
  { icon: LayoutGrid, t: "Cabinet & Countertop Companies", d: "Kitchen and bathroom cabinets, countertops, and installations." },
  { icon: Paintbrush, t: "Painting Contractors", d: "Interior and exterior residential painting." },
  { icon: Hammer, t: "Remodeling Contractors", d: "Kitchen renovations, bathroom remodels, and broader home improvement projects." },
  { icon: Brush, t: "Cleaning Companies", d: "Residential cleaning, move-in/move-out cleaning, and post-construction cleaning." },
  { icon: Wrench, t: "Handyman & Specialty Trades", d: "Home repairs, maintenance, and specialized residential services." },
  { icon: KeyRound, t: "Property Managers & Real Estate Professionals", d: "Property maintenance, improvement requests, and homeowner service connections." },
  { icon: Ruler, t: "Interior Designers & Project Coordinators", d: "Professionals coordinating residential projects who may need specialized service providers." },
];

function WhoShouldJoin() {
  return (
    <section className="pub-sec wrap">
      <div className="pub-head">
        <Eyebrow>BUILT FOR LOCAL HOME-SERVICE BUSINESSES</Eyebrow>
        <h2>
          If You Work With Homeowners, <span className="hl">There&apos;s a Place to Connect.</span>
        </h2>
        <p>We&apos;re building relationships with businesses across complementary residential services.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {trades.map((x) => (
          <article key={x.t} className="pub-card flat grid content-start gap-3 !p-5">
            <span className="pub-icon !size-10 !rounded-[12px]">
              <x.icon aria-hidden className="size-5" />
            </span>
            <h3 className="text-[17px] leading-tight">{x.t}</h3>
            <p className="m-0 text-[14px] text-[var(--ink-soft)]">{x.d}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-4 text-center">
        <p className="m-0">
          <span className="pub-strong">Don&apos;t see your trade listed?</span>{" "}
          <span className="text-[var(--ink-soft)]">You can still apply. Tell us what your company does and where you work.</span>
        </p>
        <Cta>
          Join the Local Network <ArrowRight aria-hidden className="size-5" />
        </Cta>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 07 why different */

const different = [
  { t: "Your Existing Partners Stay Yours", d: "Continue working with the contractors, suppliers, and businesses you already trust." },
  { t: "No Pressure to Refer", d: "Send an opportunity when it makes sense. There's no minimum referral requirement." },
  { t: "Service-Based Matching", d: "We consider the type of work, service area, and available business information before making introductions." },
  { t: "Homeowner Permission Comes First", d: "Contact information is shared through a permission-based referral process." },
  { t: "You Choose What to Pursue", d: "Receiving an introduction doesn't obligate you to quote or accept a project." },
  { t: "Free Participation", d: "There are no setup fees or monthly membership charges for joining the Partner Circle." },
];

function WhyDifferent() {
  return (
    <section className="pub-sec wrap">
      <div className="pub-head">
        <Eyebrow>MORE THAN ANOTHER BUSINESS DIRECTORY</Eyebrow>
        <h2>
          You Probably Already Have Referral Partners. <span className="hl">Keep Them.</span>
        </h2>
        <p>We&apos;re not asking you to replace the relationships you&apos;ve spent years building.</p>
        <p>
          We&apos;re here for the projects your existing network can&apos;t cover, the services you don&apos;t provide, and the situations where
          another professional connection could help.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {different.map((x, i) => (
          <article key={x.t} className="pub-card grid content-start gap-3">
            <span className="pub-num justify-self-start">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="text-[20px]">{x.t}</h3>
            <p className="m-0 text-[15px] text-[var(--ink-soft)]">{x.d}</p>
          </article>
        ))}
      </div>
      <p className="mt-10 mb-0 text-center text-[20px] font-extrabold">Better connections shouldn&apos;t mean more complications.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- 08 trust & control */

const trust = [
  { t: "You Decide What to Refer", d: "You're never required to send a customer to BookedUp." },
  { t: "Homeowner Permission Is Required", d: "We require appropriate permission before sharing homeowner contact information with a potential provider." },
  { t: "Information Is Used for the Relevant Request", d: "Referral information is handled according to our privacy policy and referral terms." },
  { t: "You Keep Your Existing Relationships", d: "There are no exclusivity requirements." },
  { t: "No Unrelated Marketing Permission", d: "Agreeing to a referral does not automatically authorize unrelated promotional messages." },
  { t: "No Promises We Can't Keep", d: "We don't guarantee a specific number of incoming referrals, successful matches, or completed projects." },
];

function TrustControl() {
  return (
    <section className="pub-sec wrap">
      <div className="pub-dark grid gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-5">
          <span className="pub-flow-label">YOUR CUSTOMERS. YOUR REPUTATION. YOUR CHOICE.</span>
          <h2 className="text-[32px] sm:text-[40px]">The Relationship You&apos;ve Built Matters.</h2>
          <p className="m-0 text-[17px] text-[rgba(247,244,254,.8)]">A referral isn&apos;t just a name and phone number.</p>
          <p className="m-0 text-[17px] text-[rgba(247,244,254,.8)]">It&apos;s a customer who trusts your business enough to ask for help.</p>
          <p className="m-0 text-[17px] text-[rgba(247,244,254,.8)]">
            That&apos;s why BookedUp is designed around clear expectations and responsible introductions.
          </p>
        </div>
        <ul className="grid gap-3 p-0 sm:grid-cols-2">
          {trust.map((x) => (
            <li key={x.t} className="list-none rounded-[14px] border-[1.5px] border-[rgba(247,244,254,.18)] bg-[rgba(247,244,254,.05)] p-4">
              <p className="m-0 font-extrabold">{x.t}</p>
              <p className="m-0 mt-1 text-[14px] text-[rgba(247,244,254,.75)]">{x.d}</p>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[19px] font-extrabold lg:col-span-2">
          The goal is simple: help local businesses connect <span className="text-[var(--accent-glow)]">without compromising customer trust.</span>
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 09 local area */

function LocalArea() {
  const cities = ["Orlando", "Kissimmee", "Sanford", "Winter Park", "Altamonte Springs"];
  return (
    <section className="pub-sec wrap">
      <div className="pub-head">
        <Eyebrow>STARTING IN CENTRAL FLORIDA</Eyebrow>
        <h2>
          Local Connections Start With <span className="hl">Local Businesses.</span>
        </h2>
        <p>BookedUp Partner Circle is initially focused on businesses serving Orlando and surrounding Central Florida communities.</p>
      </div>
      <div className="mx-auto grid max-w-3xl justify-items-center gap-6 text-center">
        <p className="m-0 font-bold">Our initial target areas include:</p>
        <ul className="flex flex-wrap justify-center gap-3 p-0">
          {cities.map((c) => (
            <li key={c} className="pub-pill list-none">
              <MapPin aria-hidden className="size-4 text-[var(--accent)]" /> {c}
            </li>
          ))}
        </ul>
        <p className="m-0 text-[var(--ink-soft)]">We welcome applications from nearby service areas as we evaluate network coverage.</p>
        <p className="m-0 text-[var(--ink-soft)]">
          By starting locally, we can focus on understanding the businesses, services, and project needs within the communities we serve.
        </p>
        <Cta>
          Become a Central Florida Partner <ArrowRight aria-hidden className="size-5" />
        </Cta>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 10 pricing */

function Pricing() {
  const nos = ["No setup fee.", "No monthly membership fee.", "No required referrals.", "No exclusivity.", "No obligation to purchase another service."];
  const included = [
    "Apply to join the local referral network.",
    "Create your business profile.",
    "Share your services and coverage area.",
    "Submit relevant referral opportunities.",
    "Be considered for compatible introductions.",
    "Maintain your existing business relationships.",
  ];
  return (
    <section className="pub-sec wrap">
      <div className="pub-head">
        <Eyebrow>WHAT DOES IT COST?</Eyebrow>
      </div>
      <div className="pub-card mx-auto grid max-w-3xl gap-8 !p-8 sm:!p-10 md:grid-cols-2">
        <div className="grid content-start gap-4">
          <p className="pub-price m-0">$0.</p>
          <h2 className="text-[32px]">Seriously.</h2>
          <p className="pub-strong m-0">Joining the BookedUp Partner Circle is free.</p>
          <ul className="grid gap-1 p-0 text-[15px] text-[var(--ink-soft)]">
            {nos.map((n) => (
              <li key={n} className="list-none">
                {n}
              </li>
            ))}
          </ul>
          <p className="m-0 text-[15px] text-[var(--ink-soft)]">We want to build useful relationships with good local businesses.</p>
        </div>
        <div className="grid content-start gap-5">
          <p className="pub-strong m-0">What&apos;s Included</p>
          <ul className="pub-list">
            {included.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <Cta>
            Join for Free <ArrowRight aria-hidden className="size-5" />
          </Cta>
        </div>
      </div>
      <div className="mx-auto mt-6 grid max-w-3xl gap-2 text-center">
        <p className="pub-note m-0 italic">
          BookedUp separately offers paid growth and marketing services to contractors. Joining the Partner Circle does not require purchasing
          those services.
        </p>
        <p className="pub-note m-0 italic">Network participation does not guarantee referrals, leads, projects, revenue, or a specific volume of opportunities.</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 11 final cta */

function FinalCta() {
  return (
    <section className="pub-sec wrap">
      <div className="pub-dark grid justify-items-center gap-6 px-6 py-14 text-center sm:px-12">
        <span className="pub-flow-label">READY TO CONNECT?</span>
        <h2 className="max-w-3xl text-[34px] sm:text-[48px]">
          Good Business Comes From <span className="text-[var(--accent-glow)]">Good Connections.</span>
        </h2>
        <p className="m-0 max-w-2xl text-[17px] text-[rgba(247,244,254,.8)]">
          Your next valuable relationship might be with a business that serves the same homeowners you do — just in a different way.
        </p>
        <p className="m-0 max-w-2xl text-[17px] text-[rgba(247,244,254,.8)]">
          Join a free local network built to help home-service businesses share relevant opportunities, support their customers, and build
          stronger professional relationships.
        </p>
        <Cta>
          Become a Free Local Partner <ArrowRight aria-hidden className="size-5" />
        </Cta>
        <p className="m-0 text-[14px] font-bold">Free to join · No exclusivity · No referral quotas · No guaranteed volume</p>
        <p className="m-0 text-[13px] italic text-[rgba(247,244,254,.65)]">Applications are reviewed for business and service-area fit.</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- 12 FAQ */

const faq = [
  {
    q: "Is joining BookedUp Partner Circle really free?",
    a: "Yes. There is no setup fee or monthly membership charge to join the free Partner Circle. BookedUp offers separate optional paid services, but purchasing them is not required for network participation.",
  },
  {
    q: "Will you send customers to my business?",
    a: "Your business may be considered when a suitable opportunity becomes available. The number and type of requests depend on actual referral activity, service fit, location, and availability. We do not guarantee leads, projects, or revenue.",
  },
  { q: "Do I have to send referrals to participate?", a: "No. There are no referral quotas or minimum participation requirements." },
  {
    q: "Do I have to stop working with my current referral partners?",
    a: "Absolutely not. You can continue working with your existing contractors, suppliers, and professional contacts. The Partner Circle is intended to complement those relationships, not replace them.",
  },
  {
    q: "What happens if a customer needs a service I don't provide?",
    a: "With the customer's permission, you can submit the request to BookedUp. We'll review the information and look for a suitable service provider. If a match is available, we may help coordinate an introduction.",
  },
  { q: "Can I both send and receive referrals?", a: "Yes. Your business can participate on both sides of the network." },
  {
    q: "Do you pay referral commissions?",
    a: "The free Partner Circle does not automatically pay commissions for submitted referrals. Any separate compensation arrangement would need to be expressly agreed upon and comply with applicable laws and professional requirements.",
  },
  {
    q: "How does BookedUp make money?",
    a: "BookedUp offers separate paid growth and marketing services to contractors. These services are optional and are not required to participate in the free referral network.",
  },
  {
    q: "Do I need to install an app?",
    a: "No app installation is required to apply. BookedUp coordinates participation through its available online tools and communication channels.",
  },
  {
    q: "How are businesses selected for introductions?",
    a: "We consider information such as the requested service, location, project needs, and available provider details. Being part of the network does not guarantee selection for any particular request.",
  },
  {
    q: "Does BookedUp guarantee the quality of a contractor's work?",
    a: "No. Participating service providers are independent businesses. Customers and referral partners should verify qualifications, licensing, insurance, references, and other applicable requirements before hiring.",
  },
  {
    q: "Can I join if my business is outside Orlando?",
    a: "You can apply if you serve nearby Central Florida communities. Active coverage and matching availability may vary by location.",
  },
];

function Faq() {
  return (
    <section id="faq" className="pub-sec wrap">
      <div className="pub-head">
        <h2>Frequently Asked Questions</h2>
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
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <TwoWay />
      <WhoShouldJoin />
      <WhyDifferent />
      <TrustControl />
      <LocalArea />
      <Pricing />
      <FinalCta />
      <Faq />
    </>
  );
}
