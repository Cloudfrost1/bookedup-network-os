import Link from "next/link";
import { BadgeCheck, Globe, Mail, Phone } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";

export type DirectoryRow = {
  id: string;
  slug: string;
  name: string;
  primary_category: string | null;
  city: string | null;
  state: string | null;
  verified: boolean;
  can_receive: boolean;
  services: string[];
  areas: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
};

export function DirectoryCard({ d, href, children }: { d: DirectoryRow; href?: string; children?: React.ReactNode }) {
  return (
    <Card className="grid content-start gap-3">
      <div className="grid gap-1">
        <div className="flex items-start justify-between gap-2">
          {href ? (
            <Link href={href} className="font-semibold hover:text-primary">
              {d.name}
            </Link>
          ) : (
            <span className="font-semibold">{d.name}</span>
          )}
          {d.verified ? (
            <Badge tone="purple" className="gap-1">
              <BadgeCheck aria-hidden className="size-3" /> Verified
            </Badge>
          ) : null}
        </div>
        <span className="text-sm text-muted">
          {[d.primary_category, [d.city, d.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        </span>
      </div>
      {d.services.length ? (
        <div className="flex flex-wrap gap-1">
          {d.services.slice(0, 6).map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
          {d.services.length > 6 ? <Badge>+{d.services.length - 6}</Badge> : null}
        </div>
      ) : null}
      {d.areas.length ? <p className="text-xs text-muted">Serves {d.areas.join(", ")}</p> : null}
      {d.phone || d.email || d.website ? (
        <div className="grid gap-1 text-sm">
          {d.phone ? (
            <a href={`tel:${d.phone}`} className="flex items-center gap-2 hover:text-primary">
              <Phone aria-hidden className="size-4 text-muted" /> {d.phone}
            </a>
          ) : null}
          {d.email ? (
            <a href={`mailto:${d.email}`} className="flex min-w-0 items-center gap-2 hover:text-primary">
              <Mail aria-hidden className="size-4 shrink-0 text-muted" /> <span className="truncate">{d.email}</span>
            </a>
          ) : null}
          {d.website ? (
            <a href={d.website} target="_blank" rel="noopener noreferrer nofollow" className="flex min-w-0 items-center gap-2 hover:text-primary">
              <Globe aria-hidden className="size-4 shrink-0 text-muted" /> <span className="truncate">{d.website.replace(/^https?:\/\//, "")}</span>
            </a>
          ) : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}

export function DirectoryFilters({
  action,
  categories,
  regions,
  values,
}: {
  action: string;
  categories: { id: string; name: string }[];
  regions: { id: string; city: string }[];
  values: { q?: string; service?: string; city?: string };
}) {
  const cls = "h-11 w-full rounded-lg border border-border bg-background px-3 text-base sm:text-sm";
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <input name="q" placeholder="Business name" aria-label="Business name" defaultValue={values.q ?? ""} className={cls} />
      <select name="service" aria-label="Service" defaultValue={values.service ?? ""} className={cls}>
        <option value="">All services</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select name="city" aria-label="City" defaultValue={values.city ?? ""} className={cls}>
        <option value="">All cities</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.city}
          </option>
        ))}
      </select>
      <button className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">Search</button>
    </form>
  );
}

export const isUuid = (v?: string) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null);
