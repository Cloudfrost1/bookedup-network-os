import Link from "next/link";
import type { Metadata } from "next";
import { safeNext } from "@/lib/utils";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  link_expired: "That link expired or was already used. Sign in or request a new link.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted">Sign in to your BookedUp Network account.</p>
      </div>
      <LoginForm next={safeNext(sp.next)} notice={sp.error ? NOTICES[sp.error] : undefined} />
      <p className="text-center text-sm text-muted">
        New to the network?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Join the Network
        </Link>
      </p>
    </div>
  );
}
