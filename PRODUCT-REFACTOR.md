# Urugo product refactor — review build

Review date: October 2, 2026. This is a substantial, working foundation refactor, **not completion of the entire 62-section specification or certification for production launch**. Existing property records were preserved. Changes have not been pushed or deployed to production in this pass.

## 1. Executive summary

Urugo now separates personal and management experiences, with property-scoped authorization and distinct application, tenancy, ownership, staff, and invitation relationships. Existing Vinext/React, D1/R2 storage, property records, units, payment ledger, and visual identity remain in place.

## 2. UI/UX

Preserved muted greens, editorial marketplace typography, cards and soft borders. Added operational typography, semantic status badges, actionable empty states, review panels, horizontal table scrolling, mobile navigation that does not hide destinations, focus indicators, and native keyboard-accessible dialogs. Visual browser QA is still outstanding: no browser connection was available in this session.

## 3. Navigation

The workspace selector separates **My Home & Applications** from **All Properties** and individual management properties. Navigation uses returned permission sets. Explore remains public. My Home has a lease selector for people with more than one tenancy. Search supports Cmd/Ctrl+K and only queries authorized resource classes and properties.

## 4. Marketplace

Grid/list views; location, price, currency, beds, baths, move-in, availability, amenities, pets and parking filters; persistent saved/recently viewed properties; image galleries; unit-specific application links; listing policies and an external location-map link. Paused/archived listing settings hide published inventory. No embedded map, geocoding, bookable tour calendar or paid promotion checkout was added. Current price/bed/bath filtering uses property headline fields rather than a full unit-range search engine.

## 5. Applications

Account-owned, unit-linked applications; guided steps; server autosave and explicit save-and-leave; reusable renter profile; applicant tracking; review pipeline; stage updates; information requests; internal/public notes and timeline. Unsubmitted drafts are private even from management. Personal APIs omit internal notes. Screening is a manually tracked stage, not a connected screening service. Applicant document uploads and reviewer-assignment UI remain outstanding.

## 6. Leasing lifecycle

Approval alone creates no resident access. Preparing a lease creates a pending-move-in tenancy and initial charge. Application-to-lease links prevent a second conversion of the same application. Move-in is explicitly confirmed and cannot precede the lease start date. Notice, move-out-pending and former transitions are supported. Lease signing, deposit requirements, renewal offers and automated monthly billing are not implemented.

## 7. Resident portal

Own-lease balance, due date, charges, receipt history, private/shared documents, household relationships, maintenance and messages. Multiple homes are displayed separately so the UI does not combine their currencies. Primary residents, co-residents and guarantors receive the relevant portal access; dependent/occupant relationships do not automatically grant financial access. Former residents lose live portal access; historical document retention policy needs a product decision.

## 8. Owner portal

Owner/investor-only contexts open portfolio performance: monthly recorded receipts, outstanding charges by currency, tracked-unit occupancy and open maintenance counts. Restricted investors do not receive applicants, resident lease records, private documents or sensitive work orders. No expenses or net operating income are invented; those accounting capabilities remain outstanding.

## 9. Property management

Action center for applications, open maintenance, pending move-ins and portfolio performance; an urgency-based queue for high/emergency maintenance and new applications; property-scoped screens; guided property creation; unit selection during lease preparation; household additions and lease lifecycle actions. Maintenance photos, technician assignment, permission-to-enter, work-order history, and rich notifications are not complete.

## 10. Team & Access

Replaces group-centric administration with people, roles, property scope, status, permission details, invitations, role changes and revocation. Supported roles: property manager, leasing agent, maintenance technician, accountant, owner and investor; platform admin remains a global bootstrap role. Invitations expire after seven days and grant access only after acceptance by the intended signed-in account. Delivery is in-app; email invitations are not falsely reported as sent. Change scope by revoking the old assignment and inviting at the new property. Company/portfolio hierarchy, regional roles, bulk scope changes and invite resend UI remain outstanding.

## 11. Schema

Additive tables: ownerships, staff_assignments, invitations, tenancies, household_members, renter_profiles, application_workflows, application_events, application_leases, listing_preferences, listing_details, message_context, audit_events and domain_migrations. Earlier in-progress maintenance, message and document tables are retained. Relationship indexes and uniqueness constraints cover principal lookup paths. Existing entities keep their IDs.

## 12. Authorization

`lib/permissions.ts` defines role permissions; `lib/authorization.ts` resolves assignments, ownership, property scope, permission checks, personal leases, contexts and audit statements. Non-admin account-wide owner/resident roles are no longer the management authorization source. Public browsing does not require membership. Hiding a button is never the resource authorization boundary.

## 13. Security

Tested ID-based isolation, limited staff/investor roles, private replies, lease-scoped documents, immediate role/revocation changes, draft privacy, search scope and payment retries. Added restrictive upload types, file-download headers, upload-failure cleanup, private API caching policy and cross-origin mutation checks in the Worker. Payment receipts are created atomically against open charges. The full dependency audit returned zero known vulnerabilities.

Hosting-provided identity headers must be injected by a trusted gateway that strips visitor-supplied headers. The local server intentionally uses a development administrator and must not be exposed publicly. Public customer authentication, rate limiting/abuse controls, upload scanning, retention policies, recovery procedures and production deployment security review are launch gates—not solved by passing local tests.

## 14. Migration

Generated SQL migrations 0003–0007 are included. 0004 retains legacy groups/memberships and backfills ownership from owner memberships, tenancies/households from actual leases, and workflow stages from historical application status. Resident-group membership alone does not fabricate a tenancy. Historical applications are deliberately not claimed just because their typed email matches an account. Legacy owner invitations become pending invitations; legacy resident-group invites require review against real leases.

Local runtime initialization applied these additive structures/backfills. Generated migrations were also tested on clean and seeded legacy disposable databases. **No remote production migration was performed.** Back up the target database and rehearse migration in staging before deployment; runtime schema bootstrapping and generated migrations still need consolidation.

## 15. Tests

`tests/lifecycle.test.mjs` exercises the actual local APIs using disposable properties. `tests/migration.test.mjs` tests clean migrations and legacy preservation. The latest full run passed 14 tests, covering public/draft inventory, account-owned applications, no residency on approval, invitation acceptance, pending leases, co-residents, tenant isolation, private replies/files, scoped roles, financial privacy, payment retries, multiple relationships, search, revocation and former residents.

Integration tests run only with an explicit localhost URL. They remove their own properties/files afterward and leave reusable synthetic test accounts and audit records. No existing user property was deleted.

## 16–18. Validation

- Typecheck: passing.
- Lint: passing with no reported errors/warnings; accessible-label checking is enabled. Existing async-hydration lint exception remains.
- Production build: passing. Vinext still emits upstream dynamic-import and route-classification notices.
- Full dependency audit: zero known vulnerabilities.

## 19. Remaining technical debt

Beyond the feature gaps above: the main workspace remains a large component; pagination, server-side scoped workspace queries, strict transition rules for every application stage, concurrency hardening for overlapping lease reservations, fully normalized profile data, foreign-key coverage, audit browsing/retention, consistent request schemas, and browser-driven end-to-end tests need further work. UI context selection filters already-authorized collections; it is not an authorization mechanism. Search deep links to a property/tab; exact-record focusing is implemented for applications, not every result type. Messages support property context and private replies, not a complete applicant/work-order conversation system. Featured placement has no billing or subscription logic.

## 20. Recommended next phase

First review the local flows and confirm the deployment/authentication path. Then complete the missing operational workflows and production safeguards before connecting real payments, screening, signatures and email. Run desktop/mobile browser acceptance tests and a staging migration rehearsal before launch.

## Screen-by-screen review

1. `/discover`: search, grid/list, save a home and open its details.
2. `/listings/:id`: gallery, specifications, available units, policies, question/tour inquiry and unit-specific Apply.
3. `/apply`: choose a home, complete guided steps, save and resume, submit.
4. `/?mode=personal&tab=myApplications`: next-step guidance and a private application timeline.
5. `/?mode=personal`: select a home and inspect actual charges and recorded receipts.
6. `/?mode=manage`: action center; select a property to narrow management screens.
7. `/?mode=manage&tab=applications`: review stages and notes, then prepare an approved applicant's lease.
8. `/?mode=manage&tab=residents`: unit-linked pending lease, confirm move-in, add household members, issue charges and record verified payments.
9. `/?mode=manage&tab=performance`: actual owner-facing portfolio figures, separated by currency.
10. `/?mode=manage&tab=access`: invite, inspect permissions, change a role or revoke property access.
11. Messages/Documents: private replies and explicit lease recipients for sensitive files.

Screenshots were not available because the Browser connection reported no available browsers. These descriptions are not a claim of visual QA.
