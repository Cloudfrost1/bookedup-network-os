import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { Field, Input } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "@/modules/admin/actions";
import { date } from "@/modules/format";

export const metadata: Metadata = { title: "Settings" };

type S = {
  partner_weights: Record<string, number>;
  provider_weights: Record<string, number>;
  partner_min_volume: number;
  provider_min_volume: number;
  volume_target: number;
  inactive_after_days: number;
  growth_offer_text: string;
  growth_offer_approved: boolean;
};

function Num({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <Field id={name} label={label}>
      <Input id={name} name={name} type="number" min={0} max={1000} defaultValue={value} />
    </Field>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: texts }, { data: categories }, { data: regions }] = await Promise.all([
    supabase.from("network_settings").select("*").limit(1).maybeSingle(),
    supabase.from("consent_text_versions").select("version, purpose, body, active_from").eq("active", true).order("active_from", { ascending: false }),
    supabase.from("service_categories").select("name").eq("active", true).order("sort"),
    supabase.from("regions").select("city").eq("active", true).order("sort"),
  ]);
  const s = data as S | null;
  if (!s) return <PageHeader title="Settings" description="Settings not found." />;
  const pw = s.partner_weights;
  const vw = s.provider_weights;

  return (
    <>
      <PageHeader title="Settings" description="BookedUp Orlando network rules." />
      <Flash sp={sp} />
      <form action={saveSettings} className="grid gap-4">
        <Card className="grid gap-3">
          <h2 className="font-semibold">Partner score weights</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Num name="pw_volume" label="Qualified volume" value={pw.volume} />
            <Num name="pw_rate" label="Qualification rate" value={pw.rate} />
            <Num name="pw_consistency" label="Consistency" value={pw.consistency} />
            <Num name="pw_reliability" label="No duplicates" value={pw.reliability} />
          </div>
          <h2 className="pt-2 font-semibold">Provider score weights</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Num name="vw_response" label="Response time" value={vw.response} />
            <Num name="vw_acceptance" label="Acceptance" value={vw.acceptance} />
            <Num name="vw_updates" label="Updates" value={vw.updates} />
            <Num name="vw_feedback" label="Outcome feedback" value={vw.feedback} />
            <Num name="vw_reliability" label="Reliability" value={vw.reliability} />
          </div>
          <h2 className="pt-2 font-semibold">Thresholds</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Num name="partner_min_volume" label="Min. referrals for a partner score" value={s.partner_min_volume} />
            <Num name="provider_min_volume" label="Min. opportunities for a provider score" value={s.provider_min_volume} />
            <Num name="volume_target" label="Qualified referrals for full volume points (90d)" value={s.volume_target} />
            <Num name="inactive_after_days" label="Days without qualified referral = inactive" value={s.inactive_after_days} />
          </div>
        </Card>
        <Card className="grid gap-3">
          <h2 className="font-semibold">Growth offer</h2>
          <Field id="growth_offer_text" label="Offer text">
            <Input id="growth_offer_text" name="growth_offer_text" maxLength={300} defaultValue={s.growth_offer_text} />
          </Field>
          <Checkbox
            name="growth_offer_approved"
            defaultChecked={s.growth_offer_approved}
            label="The guarantee wording was reviewed and approved for public use"
          />
        </Card>
        <Button className="justify-self-start">Save settings</Button>
      </form>
      <Card className="grid gap-3 text-sm">
        <h2 className="text-base font-semibold">Active authorization texts</h2>
        {(texts ?? []).map((t) => (
          <div key={t.version} className="grid gap-1 rounded-lg bg-surface p-3">
            <span className="font-medium">
              {t.version} · {t.purpose.replace("_", " ")} · since {date(t.active_from)}
            </span>
            <span className="text-muted">{t.body}</span>
          </div>
        ))}
        <p className="text-xs text-muted">New versions are added by the BookedUp team after legal review; past records keep the version they accepted.</p>
      </Card>
      <Card className="grid gap-2 text-sm">
        <h2 className="text-base font-semibold">Catalog</h2>
        <p>
          <span className="font-medium">Services:</span> <span className="text-muted">{(categories ?? []).map((c) => c.name).join(", ")}</span>
        </p>
        <p>
          <span className="font-medium">Cities:</span> <span className="text-muted">{(regions ?? []).map((r) => r.city).join(", ")}</span>
        </p>
      </Card>
    </>
  );
}
