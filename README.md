# BookedUp Network OS

B2B platform for the BookedUp network of home-service businesses in Orlando–Kissimmee–Sanford, Florida: business profiles, referrals with consent, opportunity distribution and partner productivity.

- Architecture, data model, permissions and roadmap: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS)

## Status

| Phase | Scope | State |
|---|---|---|
| 1 · Foundation | Design tokens, layout, auth, organizations, members, capabilities, RLS, audit log | Done |
| 2 · Network | 3-step signup, services, service areas, directory | Next |
| 3–6 | Referrals, distribution, management, Growth | Planned |

## Run locally

```bash
cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev                   # http://localhost:3000
```

## Supabase

Project: `bookedup-network` (ref `aizjanewywwasjlmuzzu`, us-east-1). Migrations live in `supabase/migrations` and are already applied.

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

## Security model (Phase 1)

- Row Level Security on every private table. Members see only their own organization; admins see all.
- Status, verification and capabilities change only through admin RPCs that re-check the role in the database.
- Members can update only profile columns of their own organization (column-level grants + RLS).
- Authorization helpers live in the non-exposed `app_private` schema.
- Every change to organizations, members, capabilities and platform roles is written to `audit_logs` (field names and status changes only, no personal data).
- Login and reset messages never reveal whether an account exists. Redirects after login accept only same-site paths.

## Tests

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_foundation.sql   # cross-access tests, rolls back, expects "ALL PASSED"
```
