import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Join the Network" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const intent = (await searchParams).as === "provider" ? "provider" : "partner";
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">{intent === "provider" ? "Apply as a Service Provider" : "Join the Network"}</h1>
        <p className="text-sm text-muted">
          {intent === "provider"
            ? "Free application and verification. Approval does not guarantee project volume."
            : "Free to join. No referral quotas. No exclusivity."}
        </p>
      </div>
      <SignupForm intent={intent} />
      <p className="text-center text-sm text-muted">
        Already a member?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
