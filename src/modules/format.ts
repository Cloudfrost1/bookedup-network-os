export const referralStatusLabel: Record<string, string> = {
  submitted: "Submitted",
  consent_pending: "Waiting for authorization",
  under_review: "Under review",
  qualified: "Qualified",
  matching: "Finding a provider",
  assigned: "Sent to provider",
  closed: "Closed",
  rejected: "Not qualified",
};

export const assignmentStatusLabel: Record<string, string> = {
  offered: "New",
  accepted: "Accepted",
  declined: "Declined",
  contacted: "Contacted",
  estimate_scheduled: "Estimate scheduled",
  estimate_sent: "Estimate sent",
  won: "Won",
  lost: "Lost",
  withdrawn: "Withdrawn",
};

export const timelineLabel: Record<string, string> = {
  asap: "As soon as possible",
  "1-3_months": "1–3 months",
  "3-6_months": "3–6 months",
  flexible: "Flexible",
};

export function toneFor(status: string): "neutral" | "purple" | "success" | "warning" | "danger" {
  if (["qualified", "assigned", "accepted", "won", "approved", "verified", "productive", "active"].includes(status)) return "success";
  if (["consent_pending", "under_review", "offered", "matching", "pending_review", "requested", "pending"].includes(status)) return "warning";
  if (["rejected", "declined", "lost", "suspended", "withdrawn", "inactive", "revoked"].includes(status)) return "danger";
  if (["contacted", "estimate_scheduled", "estimate_sent"].includes(status)) return "purple";
  return "neutral";
}

export function date(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(
    new Date(value),
  );
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export function pct(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Math.round(Number(v) * 100)}%`;
}

export function money(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v));
}
