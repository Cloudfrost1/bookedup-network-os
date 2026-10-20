import { CheckCircle2, XCircle } from "lucide-react";

export type DocRow = { kind: string; status: string; expires_on: string | null };
type State = "valid" | "expired" | "in_review" | "rejected" | "missing";

const LICENSE = ["contractor_license", "business_license"];
const INSURANCE = ["general_liability", "workers_comp"];

function stateFor(docs: DocRow[], kinds: string[], today: string): State {
  const mine = docs.filter((d) => kinds.includes(d.kind));
  if (mine.some((d) => d.status === "verified" && (!d.expires_on || d.expires_on >= today))) return "valid";
  if (mine.some((d) => d.status === "verified")) return "expired";
  if (mine.some((d) => d.status === "submitted")) return "in_review";
  if (mine.some((d) => d.status === "rejected")) return "rejected";
  return "missing";
}

/** Same rule as the database: a valid (verified, not expired) license AND a valid insurance. */
export function docsStatus(docs: DocRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  const license = stateFor(docs, LICENSE, today);
  const insurance = stateFor(docs, INSURANCE, today);
  return { license, insurance, verified: license === "valid" && insurance === "valid" };
}

const text: Record<State, string> = {
  valid: "verified and valid",
  expired: "verified but expired — needs a current one",
  in_review: "sent, waiting for BookedUp review",
  rejected: "rejected — send a new one",
  missing: "not sent yet",
};

/** Explains exactly what is missing for "Verified documents". */
export function DocsChecklist({ docs }: { docs: DocRow[] }) {
  const s = docsStatus(docs);
  const row = (label: string, st: State) => (
    <li className="flex items-start gap-2 text-sm">
      {st === "valid" ? (
        <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
      )}
      <span>
        <span className="font-medium">{label}:</span> <span className="text-muted">{text[st]}</span>
      </span>
    </li>
  );
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-surface p-3">
      <p className="text-sm font-semibold">
        {s.verified ? "Verified documents ✓" : "“Verified documents” needs both of these:"}
      </p>
      <ul className="grid gap-1.5 p-0">
        {row("License (contractor or business)", s.license)}
        {row("Insurance (general liability or workers' comp)", s.insurance)}
      </ul>
    </div>
  );
}
