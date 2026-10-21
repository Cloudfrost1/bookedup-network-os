import type { Metadata } from "next";
import { GrowthInterestForm } from "./interest-form";

export const metadata: Metadata = {
  title: "BookedUp Growth",
  description:
    "A 90-day program for qualified remodeling companies: qualified estimate requests plus the digital infrastructure needed to convert them.",
};

const FIT = [
  "Remodeling companies with real capacity to take more projects",
  "Licensed and insured, serving Central Florida",
  "A clear average ticket and a sales process that converts estimates",
  "Ready to respond fast and keep project status up to date",
];
const INCLUDED = [
  "Qualified estimate requests — checked and authorized by BookedUp before you receive them",
  "A contracted target over 90 days, tracked in your dashboard: delivered, remaining, pace and deadline",
  "Only validated requests count toward the target — not every lead sent",
  "Digital infrastructure to convert demand: website, SEO and Google Business Profile",
];
const STEPS = [
  ["Apply as a provider", "Free profile, services, cities, capacity and documents."],
  ["Get verified", "BookedUp reviews your license, insurance and capacity."],
  ["Growth Review", "A conversation about capacity, ticket, close rate and regions — to confirm we can really deliver for you."],
  ["Program starts", "Your 90-day target begins and every qualified request is tracked."],
];

export default function GrowthPage() {
  return (
    <>
      <section className="wrap grid gap-6 pt-12 pb-10 sm:pt-16">
        <span className="pub-flow-label !text-[var(--accent)]">BOOKEDUP GROWTH</span>
        <h1 className="max-w-3xl text-[38px] sm:text-[52px]">
          A more predictable pipeline for <span className="hl">qualified remodeling companies.</span>
        </h1>
        <p className="pub-lead m-0 max-w-2xl">
          BookedUp Growth helps qualified remodeling companies receive a contracted number of qualified estimate requests in 90 days while building
          the digital infrastructure needed to convert that demand.
        </p>
        <p className="m-0 max-w-2xl text-[15px] text-[var(--ink-soft)]">
          It&apos;s a consultative program, not a software plan. Joining the BookedUp Network as a referral partner stays free.
        </p>
        <a href="#apply" className="pub-btn justify-self-start">
          See if Growth fits your business →
        </a>
      </section>

      <section className="pub-sec wrap">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <article className="pub-card grid content-start gap-4">
            <h2 className="text-[24px]">Who it&apos;s for</h2>
            <ul className="pub-list">
              {FIT.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </article>
          <article className="pub-card grid content-start gap-4">
            <h2 className="text-[24px]">What&apos;s included</h2>
            <ul className="pub-list">
              {INCLUDED.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="pub-sec wrap">
        <div className="pub-dark mx-auto grid max-w-5xl gap-5 px-6 py-10 sm:px-12">
          <span className="pub-flow-label">HOW IT WORKS</span>
          <ol className="grid gap-3 p-0 md:grid-cols-2">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex list-none gap-4 rounded-[14px] border-[1.5px] border-[rgba(247,244,254,.18)] bg-[rgba(247,244,254,.05)] p-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] font-mono text-sm font-bold text-white">{i + 1}</span>
                <span className="grid gap-1">
                  <b className="text-[16px]">{t}</b>
                  <span className="text-[15px] leading-[1.5] text-[rgba(247,244,254,.85)]">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="apply" className="pub-sec wrap">
        <div className="mx-auto grid max-w-2xl gap-5">
          <div className="pub-head !mb-0">
            <h2>
              Talk to <span className="hl">BookedUp</span>
            </h2>
            <p className="pub-note m-0">Tell us about your company. We&apos;ll contact you to schedule a Growth Review.</p>
          </div>
          <div className="pub-auth pub-form pub-auth-card">
            <GrowthInterestForm />
          </div>
        </div>
      </section>
    </>
  );
}
