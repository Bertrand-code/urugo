# Urugo

Urugo is a property-operations workspace for property managers, owners, and residents in Burundi.

## What it includes

- Durable property listings with draft and published states
- A public rental application form and owner review queue
- Per-property access groups for property owners and residents
- Administrator-only property deletion and access management
- A public contact form with a private inquiry queue

## Roles and access

- **Administrator**: manages all properties, access groups, applications, and contact inquiries.
- **Property owner**: sees only properties assigned through an owner group and their applications.
- **Resident**: sees only properties assigned through a resident group.

The initial administrator is btuyisenge40@gmail.com. Administrators can create groups in the **Access** section, attach each group to a property, and grant access by email. New people receive their assigned access on first sign-in.

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
