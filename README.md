# Urugo

Urugo combines public property discovery, account-owned applications, resident services, and property-scoped management. This is a local review build; see [the refactor report](PRODUCT-REFACTOR.md) for implemented workflows, test results, migration details, and remaining production launch requirements.

## Local review

```sh
npm install
npm run dev -- --port 3000
```

Open http://localhost:3000/discover for the marketplace or http://localhost:3000 for the workspace. The workspace selector switches between personal access, the management portfolio, and individual properties. Selecting an experience never grants permissions.

Local development intentionally defaults to an administrator. Do not expose this development server to the internet. Hosted identity depends on trusted platform-injected authentication headers; external customer sign-in requires deployment-specific confirmation.

## Working flows

- Public rent/sale listings, search filters, grid/list views, photos, units, saved homes, and recently viewed homes.
- Guided applications with server-saved drafts, reusable profile data, account ownership, review stages, and internal/private timelines.
- Approved application → pending lease → pending move-in tenancy → confirmed active resident, with notice and move-out transitions.
- Resident balances, due dates, receipt history, household relationships, maintenance, private replies, and scoped documents.
- Management action center, property scope selector, authorized portfolio search, and owner/investor performance views.
- Team & Access with property-scoped invitations, explicit acceptance, role changes, revocation, and centralized permission checks.
- Public contact inquiries stored for administrator review.

Owners, staff, applicants and residents can be the same account at different properties. Groups are retained as legacy migration records, not the primary administration or authorization interface.

## Financial and external integrations

Payments currently record verified cash/transfer receipts; they do not move money. Screening is a manually tracked stage. No payment checkout, screening provider, electronic signature service, recurring billing scheduler, or paid-listing subscription is connected.

Contact inquiries are always stored. Email notifications to **btuyisenge40@gmail.com** require:

```dotenv
RESEND_API_KEY=...
CONTACT_FROM_EMAIL="Urugo <hello@your-verified-domain.com>"
```

Use a verified sender. Without working provider configuration, do not claim email delivery. Team invitations are available in-app on sign-in; invitation email delivery is not implemented. Never commit secret keys.

## Data and migration

D1 stores records; R2 stores files. Additive migrations preserve existing IDs, groups, properties, applications and leases. Owner memberships become ownerships; actual leases produce tenancies and household members; resident groups alone do not create residency. Historical applications remain unclaimed until verified rather than trusting their typed email.

Generated migrations and local runtime backfill are included and tested. No remote database migration has been performed in this pass. Back up and rehearse against staging before production deployment.

## Validation

```sh
npm run typecheck
npm run lint
npm run build
npm test
URUGO_TEST_URL=http://localhost:3000 npm test
npm audit
```

Without `URUGO_TEST_URL`, only offline migration tests run and the integration suite is explicitly skipped. The local integration run uses synthetic accounts and disposable properties; it deletes only those properties afterward.

The last full local run passed 14 tests. Typecheck, lint and build pass. The full dependency audit reported zero known vulnerabilities on October 2, 2026. This does not replace security review, provider configuration, staging migration rehearsal, or browser/mobile acceptance testing.
