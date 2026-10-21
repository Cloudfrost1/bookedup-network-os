/** One explanation of matching, used everywhere it is described. Keep in sync with admin_match_suggestions_v3 / provider_blockers. */
export const MATCHING_FACTORS = ["service", "region", "project size (ticket)", "capacity", "availability", "documents", "reliability"] as const;

export const MATCHING_SENTENCE =
  "BookedUp considers service, region, project size (ticket), capacity, availability, documents and reliability.";

export function MatchingNote({ className = "" }: { className?: string }) {
  return (
    <p className={`m-0 text-sm text-muted ${className}`}>
      <span className="font-medium text-foreground">How matching works:</span> {MATCHING_SENTENCE} Only providers with verified documents and
      capacity confirmed in the last 30 days can receive a project.
    </p>
  );
}
