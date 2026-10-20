import Link from "next/link";
import type { Metadata } from "next";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Check your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <div className="grid justify-items-start gap-4">
      <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary">
        <MailCheck aria-hidden className="size-5" />
      </span>
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="text-sm text-muted">
        We sent a confirmation link to <span className="font-medium text-foreground">{email ?? "your inbox"}</span>.
        Open it on this device to activate your account.
      </p>
      <Link href="/login" className="text-sm font-medium text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
