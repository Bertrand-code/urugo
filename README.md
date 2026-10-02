# Urugo

Urugo is a property-operations workspace for property managers, owners, and residents in Burundi.

## What it includes

- A public home marketplace at /discover, with rental and sale listings
- Listing detail pages with location, pricing, property facts, photos, and available units
- Property creation with owner assignment, address, price, sale/rental intent, specs, descriptions, and photo uploads
- A public rental application form and owner review queue
- Unit records with their own price and availability
- Resident leases, first rent charges, payment history, and an amount-due portal
- Per-property access groups for property owners and residents
- Administrator-only property deletion and access management
- A public contact form with a private inquiry queue

## Roles and access

- **Administrator**: manages all listings, units, access groups, applications, residents, balances, and contact inquiries.
- **Property owner**: sees only properties assigned through an owner group, their applicants, and their resident records.
- **Resident**: sees their active lease, amount due, due date, open charges, and recorded payment history.

The initial administrator is btuyisenge40@gmail.com. Administrators can create groups in the **Access** section, attach each group to a property, and grant access by email. New people receive their assigned access on first sign-in.

Creating a resident lease in **Residents** links that resident's email to their portal. Their first rent charge is visible as soon as they sign in with that same email address.

## Payments

The resident portal currently provides a durable balance and payment ledger. Management can use the payment endpoint to record received payments. Live card, mobile-money, or bank-transfer checkout requires a connected payment processor and its account credentials; it is intentionally not simulated as a real payment.

## Local development

    npm install
    npm run dev -- --port 3000

The local server provides a development administrator account so the workspace can be exercised without a hosted sign-in session.

## Email notifications

Every contact inquiry is stored in the workspace under **Inquiries**. To also receive each inquiry by email at btuyisenge40@gmail.com, configure these runtime secrets before deployment:

    RESEND_API_KEY=...
    CONTACT_FROM_EMAIL="Urugo <hello@your-verified-domain.com>"

CONTACT_FROM_EMAIL must be a sender verified with Resend. Without these values, the contact form still records every inquiry safely in the dashboard, but does not send an email notification.

## Validation

    npm run build
    npm test
