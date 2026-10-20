import Link from "next/link";
import { ArrowRight, Ban, Handshake, ListChecks, MapPin, Send, UserRound, Users } from "lucide-react";

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

/** Decorative network illustration: businesses (nodes) passing a project along. No text. */
function HeroArt() {
  return (
    <div className="pub-hero-art" aria-hidden>
      <div className="pub-dark absolute inset-0 grid place-items-center p-8">
        <svg viewBox="0 0 320 320" className="h-auto w-full">
          <g stroke="#F7F4FE" strokeOpacity=".35" strokeWidth="3" strokeDasharray="8 8" fill="none">
            <path d="M80 90 L160 160 L250 100" />
            <path d="M160 160 L110 245" />
            <path d="M160 160 L235 235" />
          </g>
          <path d="M80 90 L160 160 L235 235" stroke="#A78BFA" strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="160" cy="160" r="34" fill="#7C3AED" stroke="#17120D" strokeWidth="3" />
          <path d="M146 160h28m-10-10 10 10-10 10" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {[
            [80, 90],
            [250, 100],
            [110, 245],
            [235, 235],
          ].map(([x, y], i) => (
            <g key={i}>
              <rect x={x - 24} y={y - 24} width="48" height="48" rx="14" fill={i === 0 || i === 3 ? "#F7F4FE" : "#2A2622"} stroke="#17120D" strokeWidth="3" />
              <rect x={x - 10} y={y - 4} width="20" height="14" rx="3" fill={i === 0 || i === 3 ? "#7C3AED" : "#6B6055"} />
              <path d={`M${x - 13} ${y - 3} L${x} ${y - 14} L${x + 13} ${y - 3}`} stroke={i === 0 || i === 3 ? "#7C3AED" : "#6B6055"} strokeWidth="4" fill="none" strokeLinejoin="round" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="wrap grid items-center gap-12 pt-16 pb-12 sm:pt-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="grid justify-items-start gap-7">
          <span className="pub-pill">
            <span className="dot" aria-hidden /> Orlando · Kissimmee · Sanford
          </span>
          <h1 className="text-[40px] sm:text-[54px] lg:text-[64px]">
            Turn Missed Jobs Into <span className="hl">Better Connections.</span>
          </h1>
          <p className="max-w-xl text-lg text-[var(--ink-soft)]">
            Join a professional network of local home-service businesses. Refer projects outside your scope and connect
            with qualified service providers.
          </p>
          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
            <Link href="/signup" className="pub-btn">
              Join the Network <ArrowRight aria-hidden className="size-5" />
            </Link>
            <Link href="/how-it-works" className="pub-btn ghost">
              See how it works
            </Link>
          </div>
        </div>
        <HeroArt />
      </section>

      <section className="wrap grid gap-10 py-16" aria-labelledby="how">
        <div className="grid justify-items-center gap-3 text-center">
          <h2 id="how" className="text-[32px] sm:text-[44px]">
            How it <span className="hl">works</span>
          </h2>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="pub-card grid content-start gap-4">
              <div className="flex items-center justify-between">
                <span className="pub-icon">
                  <s.icon aria-hidden className="size-5" />
                </span>
                <span className="pub-num">Step {i + 1}</span>
              </div>
              <h3 className="text-[22px] sm:text-[24px]">{s.title}</h3>
              <p className="text-[15px] text-[var(--ink-soft)]">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap py-8">
        <div className="pub-dark grid gap-8 px-6 py-10 sm:px-10 sm:py-14">
          <h2 className="text-[30px] sm:text-[40px]">Built for local businesses</h2>
          <ul className="flex flex-wrap gap-3">
            {benefits.map((b) => (
              <li key={b.title} className="pub-chip">
                <b.icon aria-hidden className="size-5" />
                {b.title}
              </li>
            ))}
          </ul>
          <div>
            <Link href="/signup" className="pub-btn">
              Join the Network <ArrowRight aria-hidden className="size-5" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
