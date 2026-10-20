# BookedUp Network OS

B2B platform for the BookedUp network of home-service businesses in Orlando–Kissimmee–Sanford, Florida: business profiles, referrals with consent, opportunity distribution and partner productivity.

- Architecture, data model, permissions and roadmap: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS)

## Status

| Phase | Scope | State |
|---|---|---|
| 1 · Foundation | Design tokens, layout, auth, organizations, members, capabilities, RLS, audit log | Done |
| 2 · Network | Business onboarding with services and cities, public/private directory, coverage page, connections, team | Done |
| 3 · Referrals | Direct referral with partner attestation, homeowner link `/r/[code]` with versioned consent, admin consent confirmation, 7-point qualification, duplicate check | Done |
| 4 · Distribution | Rule-based suggestions, one active provider per referral, accept/decline, contact reveal after accept (audited), pipeline | Done |
| 5 · Management | Admin overview with Action Required, organizations + follow-up, rankings, regional coverage, relationships, reports | Done |
| 6 · Growth | Growth contracts (target in 90 days), automatic delivery counting, delivery audit, offer text gated by approval | Done |
| 7 · Billing | Tables only (plans, subscriptions, entitlements, usage limits, billing events). No checkout. | Schema only |

## Three environments

| Area | Path | Who | Main jobs |
|---|---|---|---|
| Partner (anchor) | `/partner` | Businesses that refer | Profile, services, cities, send full-scope referrals (photos, budget, needs), referral link, status, feedback on providers, ranking |
| Provider | `/provider` | Businesses that receive | Opportunities (accept/decline, pipeline, appointment), operational capacity, documents, reliability history |
| BookedUp Admin | `/admin` | Platform admins | Approvals, partners, providers, document review, referrals, matching, verified feedback, Growth, rankings, coverage, reports, settings |

After login, `/app` sends each account to its own area. Accounts with more than one area get a switcher in the sidebar.

Rules that keep this from becoming an open marketplace: providers never browse projects; BookedUp sends each qualified project to one provider at a time. Address and homeowner contact stay hidden until authorization is confirmed and the provider accepts. Badges are earned: "Verified documents" needs a valid license and insurance checked by BookedUp; "Trusted Provider" also needs 5 accepted opportunities, 3 verified feedbacks (avg ≥ 4, showed up ≥ 90%) and no stalled projects.

## Run locally

```bash
cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev                   # http://localhost:3000
```

## Supabase

Project: `bookedup-network` (ref `aizjanewywwasjlmuzzu`, us-east-1). Migrations live in `supabase/migrations` and are already applied.

Production: https://bookedup-network-os.vercel.app (Vercel project `bookedup-network-os`, deploys on every push to `main`).

**Auth settings to configure in the Supabase dashboard (Authentication → URL Configuration):**
- Site URL: the production URL (e.g. `https://network.bookedup.com`)
- Redirect URLs: `http://localhost:3000/**` and the production `https://…/**`
- Keep "Confirm email" on. Enable MFA (TOTP) for admin accounts.

**Make the first super admin** (run once in the SQL editor after signing up):

```sql
update public.profiles set platform_role = 'super_admin'
where id = (select id from auth.users where email = 'you@example.com');
```

After that, super admins promote other admins with `super_admin_set_platform_role`; nobody can change their own role.

## Security model

- Row Level Security on every private table. Members see only their own organization; admins see all.
- Status, verification and capabilities change only through admin RPCs that re-check the role in the database.
- Members can update only profile columns of their own organization (column-level grants + RLS).
- Authorization helpers live in the non-exposed `app_private` schema.
- Every change to organizations, members, capabilities and platform roles is written to `audit_logs` (field names and status changes only, no personal data).
- Login and reset messages never reveal whether an account exists. Redirects after login accept only same-site paths.

## Tests

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_foundation.sql    # cross-access tests, rolls back, expects "ALL PASSED"
psql "$DATABASE_URL" -f supabase/tests/flow_end_to_end.sql   # signup → approval → referral → consent → qualify → match → accept → pipeline → Growth → scores
psql "$DATABASE_URL" -f supabase/tests/flow_capacity_reliability.sql  # capacity, documents, full-scope request, photos, verified feedback, earned badge
```

Both suites pass against the production database (run inside a transaction and rolled back).

## Known limits of this MVP

- No e-mail or SMS notifications yet: notifications are in-app (bell pages). Supabase sends only auth e-mails.
- Team members are added by e-mail only if they already have an account; removing a member is done by BookedUp.
- Scores are recalculated from Admin → Rankings → "Recalculate now".
- Privacy Policy, Terms and the consent texts are drafts pending legal review.
