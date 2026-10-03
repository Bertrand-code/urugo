# Urugo Cars & Health — local pilot implementation

## What changed

Two separate product experiences now share Urugo's existing accounts, D1 database, R2 storage, typography and muted-green identity. Homes and the rental operating platform remain intact. Navigation from Homes links to both products; neither product reuses property assignments for authorization.

This is a functional pilot foundation, not a claim of public-launch readiness or regulatory approval. No real listings, pharmacies, clinics, stock, licences, or appointment confirmations have been invented.

## Screens and workflows

| Screen | Working flow |
| --- | --- |
| `/cars` | Search published vehicles by make/model/location, price/currency, year, mileage, fuel and transmission; paginated cards |
| `/cars/:id` | Real uploaded photos, specifications, seller description, saved car, private buyer inquiry; record-specific share metadata |
| `/cars/manage` | Save/edit draft → upload photos → submit → platform publication review → published → sold/archive; private inquiry replies and saved shortlist |
| `/health` | Search participating pharmacies, exact medicine names/strengths/forms, provider-reported availability and update timestamps; find published clinic slots |
| `/health/requests` | Track own pharmacy requests and appointments; see provider confirmations, collection-window expiry, address and contact; cancel active requests |
| `/health/manage` | Register provider → manual licence/contact verification; maintain catalog, stock checks, appointment slots and requests; explicitly grant/revoke provider staff access |
| Verification desk | Platform administrators review business details and publication status without automatically receiving unrelated patient requests |

Cars are not represented as inspected, ownership-verified or guaranteed. The platform does not handle deposits, escrow or vehicle payments. Sellers choose private/dealer status; that choice is not a verified dealer badge.

Health coordinates requests, not care or dispensing. It does not diagnose, recommend alternatives, collect prescriptions or clinical documents, sell medicines, or offer emergency services. Requests disclose the selected medicine/service and the patient's account display name only to the relevant provider team. No public patient lists or contact details are exposed.

## Lifecycles and integrity

- Car listing: `draft → pending → published → sold / archived`. Editing published content returns it to draft. At least one real uploaded image is required for submission/publication.
- Provider: `pending → verified / suspended`. Approval requires an explicit reviewer attestation and evidence/reason. Suspension removes public listings and cancels outstanding requests/appointments.
- Pharmacy request: `requested → confirmed → collected`; alternatives `unavailable / cancelled / expired`. Confirmation requires a future hold deadline of at most 48 hours. Unanswered requests expire after 48 hours. Public stock information older than 24 hours is labelled stale; this is a product freshness policy, not a clinical standard. Stock listings never guarantee availability.
- Appointment: `requested → confirmed → completed`; alternatives `declined / cancelled / expired`. Requests are not confirmed bookings. A partial unique database index prevents two active bookings for the same slot. Atomic slot creation rejects overlapping open times for the same practitioner name at the same facility. Practitioner names are not yet normalized practitioner identities.
- Slot closure cancels active bookings. Patients may cancel their own requests; providers confirm them. Completion cannot occur before a consultation ends.
- Dates are stored in UTC; clinic entry and display explicitly use Burundi time (`Africa/Bujumbura`, UTC+2).
- Expiry is enforced on request creation or private workspace reads. A scheduled expiration/notification worker remains a launch prerequisite; no background scheduler was silently configured.

## Authorization and storage

- Identity is resolved by the existing account helper, never by a client-submitted seller/patient ID.
- Car owners edit their own vehicles. Platform administrators moderate listings but do not automatically receive buyer–seller conversations.
- Health resource authorization is centralized in `lib/products.ts`. Only the provider owner or an active `health_staff` assignment can read that provider's patient requests. Property owners, property managers, residents, vehicle sellers, and platform review privileges do not implicitly grant this access.
- Staff access is checked on each request. Only the provider owner grants/revokes staff. Team addition currently requires an existing account and sends no email invitation.
- Public API responses select public fields. Provider licence references, owner identifiers, review notes, patient data, and R2 object keys are not included in discovery responses.
- Inputs have bounded text lengths and numeric/date/enum validation. Queries use bound parameters. Vehicle images are restricted to JPEG/PNG/WebP, with file signatures, size/count limits, private draft access and `nosniff` responses.
- Sensitive API responses use private/no-store caching. Existing same-origin mutation protection is preserved. Key listing, verification, staff and request transitions use the existing audit table without clinical content.

### Additive database migration

`drizzle/0008_complex_franklin_storm.sql` creates 10 product tables: `vehicles`, `vehicle_photos`, `vehicle_favorites`, `vehicle_inquiries`, `health_facilities`, `health_staff`, `medicine_inventory`, `medicine_requests`, `appointment_slots`, `health_appointments`, plus their scope, lookup and uniqueness indexes. Existing rental tables and data are not rewritten or removed. Schema definitions are in `db/products.ts`, re-exported by `db/schema.ts`.

The current preview bootstraps this exact generated migration using idempotent CREATE statements, following the app's existing runtime initialization. Hosting must apply the saved migrations to the hosted D1 database before launch. No production migration or deployment was performed in this work.

## Validation

- Latest local run: **24 tests passed, 0 failed, 0 skipped**; **typecheck passed**, **ESLint passed**, **production build passed**. Build output retains non-blocking framework deprecation/chunking notices. Preview routes were verified on port 3000.
- Typecheck and ESLint run separately from the production build.
- Existing rental lifecycle regressions remain in the suite.
- New product integration coverage includes drafts, input/upload validation, private image access, publication, inquiry privacy, favourite persistence, minimal public responses, manual verification, stale stock, patient isolation, staff scope and revocation, hold expiry, concurrent booking conflicts, slot closure, provider suspension, route rendering and detail metadata.
- Generated migrations are applied to disposable SQLite databases and checked against legacy rental data.
- Integration tests require an explicit local URL; product tests additionally require an explicit preview D1 file for fixture cleanup. They check synthetic owners and remove only fixture resources returned by the test. They must not run against production.
- Browser screenshots were not available in this environment. HTTP rendering and automated workflow checks do not replace mobile/browser acceptance testing.

## Required before a public pilot

1. **Domain and deployment decision.** If Urugo owns `urugo.com`, use `cars.urugo.com` and `health.urugo.com`. `urugo.cars.com` would require control of `cars.com`. Current routes are local paths, not live subdomains. Cross-subdomain login, cookies and redirects need an explicit hosting/auth decision.
2. **Public authentication.** The existing app trusts identity headers supplied by the Sites authentication boundary. Local development intentionally uses an administrator fallback. Do not expose the development server or deploy directly behind an untrusted proxy that lets visitors forge those headers. Confirm the supported public-login path before building a separate authentication stack.
3. **Healthcare operational/privacy review.** Obtain local advice, independently verify participating providers, agree to responsibilities and response times, publish patient consent/privacy and retention policies, and choose an appropriate deployment/data-handling environment. Storing a licence reference is not independent verification or legal approval.
4. **Notifications and operations.** Connect consented email/SMS/WhatsApp delivery and reminders, delivery monitoring, an expiry scheduler and an escalation process. Current replies are visible in-app after refresh; no automated notifications are sent by these new products.
5. **Abuse and reliability controls.** Add distributed rate limits, account verification, moderation/reporting operations, security monitoring, backup/restore validation and health-data access auditing/retention. Load/concurrency testing should include revoke/update races and very large catalogs.
6. **Provider UX and integrations.** Pilot with real pharmacies and clinics; add French/Kirundi, inventory import/POS synchronization, canonical medicine identifiers, normalized practitioner records, multi-location provider administration, pagination beyond pilot workspace limits, granular healthcare staff roles, and rescheduling. Search is text matching, not therapeutic equivalence.
7. **Cars operations.** Add seller/dealer verification, reporting/fraud response, optional inspection partners, dealer subscription entitlements and promoted-listing billing only after commercial rules and a payment provider are chosen. No revenue or payment processing is simulated.

No remote push, public deployment, DNS changes, email sends or real provider onboarding were performed.
