"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/utils";

export type FormState = { error?: string; success?: string; fields?: Record<string, string> };

const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
const password = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : env.siteUrl;
}

// Generic messages on purpose: never reveal whether an account exists.
const GENERIC_LOGIN_ERROR = "Email or password is incorrect, or the email is not confirmed yet.";

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password.") }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const fields = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.status === 429 ? "Too many attempts. Wait a minute and try again." : GENERIC_LOGIN_ERROR, fields };

  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Enter your full name.").max(120),
      email,
      password,
      terms: z.literal("on", { error: "Accept the Terms and Privacy Policy to continue." }),
    })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      terms: formData.get("terms"),
    });
  const fields = { fullName: String(formData.get("fullName") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        terms_accepted_at: new Date().toISOString(),
        terms_version: "draft-2026-10",
        signup_intent: formData.get("intent") === "provider" ? "provider" : "partner",
      },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/app`,
    },
  });
  if (error) {
    if (error.code === "over_email_send_rate_limit")
      return {
        error: "We can't send the confirmation e-mail right now because too many sign-ups happened in the last hour. Please try again later.",
        fields,
      };
    if (error.status === 429) return { error: "Too many attempts. Wait a minute and try again.", fields };
    if (error.code === "email_address_invalid") return { error: "Use a real e-mail address you can open — we send a confirmation link.", fields };
    if (/password/i.test(error.message)) return { error: "Choose a stronger password.", fields };
    return { error: "We could not create the account. Check the details and try again.", fields };
  }
  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
  });
  return { success: "If an account exists for that email, a reset link is on its way. It expires in 1 hour." };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Could not update the password. Request a new link and try again." };
  redirect("/app?password=updated");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
