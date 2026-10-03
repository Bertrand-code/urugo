import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.URUGO_TEST_URL;
const enabled = Boolean(base);
if (enabled && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error(
    "Integration tests may only run against an explicitly selected local server.",
  );
const people = Object.fromEntries(
  [
    "renter",
    "other",
    "manager",
    "leasing",
    "technician",
    "investor",
    "owner",
    "roommate",
  ].map((name) => [
    name,
    {
      id: `urugo-regression-${name}`,
      email: `urugo-regression-${name}@example.invalid`,
    },
  ]),
);
async function request(path, { as, method = "GET", body } = {}) {
  const headers = {};
  if (as) {
    headers["oai-authenticated-user-id"] = people[as].id;
    headers["oai-authenticated-user-email"] = people[as].email;
  }
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}
function ok(result, status = 200) {
  assert.equal(result.status, status, JSON.stringify(result.data));
  return result.data;
}

test(
  "property-scoped rental lifecycle and authorization regressions",
  { skip: !enabled },
  async (t) => {
    const properties = [];
    t.after(async () => {
      for (const id of properties) {
        const result = await request("/api/properties/" + id, {
          method: "DELETE",
        });
        assert.equal(
          result.status,
          204,
          "Failed to clean disposable property " + id,
        );
      }
    });
    for (const as of Object.keys(people)) ok(await request("/api/me", { as }));
    async function property(status) {
      const result = ok(
        await request("/api/properties", {
          method: "POST",
          body: {
            name: "URUGO REGRESSION " + status + " " + Date.now(),
            neighborhood: "Test Quarter",
            address: "1 Test Street",
            city: "Test City",
            homes: 4,
            priceAmount: 1000,
            currency: "USD",
            bedrooms: 2,
            bathrooms: 1,
            status,
          },
        }),
        201,
      );
      properties.push(result.property.id);
      return result.property.id;
    }
    const a = await property("published"),
      b = await property("draft");
    const unit = ok(
      await request("/api/properties/" + a + "/units", {
        method: "POST",
        body: {
          name: "Test 101",
          bedrooms: 2,
          bathrooms: 1,
          priceAmount: 1000,
          currency: "USD",
        },
      }),
      201,
    ).unit.id;
    await t.test(
      "public inventory hides drafts and operational fields",
      async () => {
        const listings = ok(
          await request("/api/marketplace", { as: "other" }),
        ).listings;
        assert(listings.some((p) => p.id === a));
        assert(!listings.some((p) => p.id === b));
        for (const field of [
          "occupied",
          "created_by",
          "access_role",
          "owner_email",
        ])
          assert(!(field in listings.find((p) => p.id === a)));
        assert.equal(
          (await request("/api/listings/" + b, { as: "other" })).status,
          404,
        );
        assert.equal(
          ok(await request("/api/properties", { as: "other" })).properties
            .length,
          0,
        );
      },
    );
    let application;
    await t.test(
      "application is account-owned, unit-specific, private, and creates no residency",
      async () => {
        application = ok(
          await request("/api/applications", {
            as: "renter",
            method: "POST",
            body: { propertyId: a, unitId: unit, draft: true },
          }),
          201,
        ).application.id;
        assert.equal(
          (await request("/api/applications/" + application)).status,
          404,
          "Unsubmitted drafts are private even from management",
        );
        assert.equal(
          ok(
            await request("/api/applications/" + application, { as: "renter" }),
          ).application.unit_id,
          unit,
        );
        assert.equal(
          (await request("/api/applications/" + application, { as: "other" }))
            .status,
          404,
        );
        assert.equal(
          ok(await request("/api/applications", { as: "renter" })).applications
            .length,
          0,
        );
        ok(
          await request("/api/applications/" + application, {
            as: "renter",
            method: "PATCH",
            body: {
              stage: "submitted",
              fullName: "Regression Renter",
              phone: "+1 555 0100",
              householdSize: 1,
            },
          }),
        );
        assert.equal(
          ok(
            await request("/api/applications?experience=personal", {
              as: "renter",
            }),
          ).applications.length,
          1,
        );
        assert.equal(
          ok(await request("/api/resident", { as: "renter" })).leases.length,
          0,
        );
        assert.equal(
          (
            await request("/api/properties/" + a, {
              as: "renter",
              method: "PATCH",
              body: { status: "draft" },
            })
          ).status,
          403,
        );
      },
    );
    const assigned = {};
    async function invite(as, role, propertyId = a) {
      const invitation = ok(
        await request("/api/team", {
          method: "POST",
          body: { propertyId, email: people[as].email, role },
        }),
        201,
      );
      return invitation.id;
    }
    await t.test(
      "pending invitations grant no access; acceptance is identity-bound",
      async () => {
        const id = await invite("manager", "property_manager");
        assert.equal(
          ok(await request("/api/applications", { as: "manager" })).applications
            .length,
          0,
        );
        assert.equal(
          (
            await request("/api/team", {
              as: "other",
              method: "POST",
              body: { action: "accept", id },
            })
          ).status,
          404,
        );
        ok(
          await request("/api/team", {
            as: "manager",
            method: "POST",
            body: { action: "accept", id },
          }),
        );
        assert(
          ok(
            await request("/api/applications", { as: "manager" }),
          ).applications.some((p) => p.id === application),
        );
        assert.equal(
          (
            await request("/api/properties/" + b, {
              as: "manager",
              method: "PATCH",
              body: { status: "published" },
            })
          ).status,
          403,
        );
        assigned.manager = ok(await request("/api/team")).members.find(
          (m) => m.email === people.manager.email && m.source === "staff",
        );
      },
    );
    await t.test(
      "review notes stay internal and approval grants no resident access",
      async () => {
        ok(
          await request("/api/applications/" + application, {
            as: "manager",
            method: "PATCH",
            body: {
              stage: "approved",
              note: "INTERNAL-REGRESSION-SECRET",
              internal: true,
            },
          }),
        );
        assert(
          !JSON.stringify(
            ok(
              await request("/api/applications/" + application, {
                as: "renter",
              }),
            ),
          ).includes("INTERNAL-REGRESSION-SECRET"),
        );
        assert.equal(
          ok(await request("/api/resident", { as: "renter" })).leases.length,
          0,
        );
      },
    );
    let lease;
    await t.test(
      "lease starts pending; resident can see their own balance before move-in",
      async () => {
        lease = ok(
          await request("/api/leases", {
            as: "manager",
            method: "POST",
            body: {
              propertyId: a,
              unitId: unit,
              residentName: "Regression Renter",
              residentEmail: people.renter.email,
              monthlyRent: 1000,
              currency: "USD",
              dueDay: 5,
              startDate: "2026-01-01",
              dueDate: "2026-01-05",
            },
          }),
          201,
        ).lease;
        assert.equal(lease.status, "pending");
        const portal = ok(await request("/api/resident", { as: "renter" }));
        assert.equal(portal.leases.length, 1);
        assert.equal(portal.balance, 1000);
        assert.equal(
          ok(await request("/api/resident", { as: "other" })).leases.length,
          0,
        );
        assert.equal(
          (
            await request("/api/tenancies", {
              as: "renter",
              method: "PATCH",
              body: { leaseId: lease.id, status: "active" },
            })
          ).status,
          403,
        );
        ok(
          await request("/api/tenancies", {
            as: "manager",
            method: "PATCH",
            body: { leaseId: lease.id, status: "active" },
          }),
        );
      },
    );
    let work;
    await t.test(
      "maintenance, private documents and household are tenant-scoped",
      async () => {
        work = ok(
          await request("/api/maintenance", {
            as: "renter",
            method: "POST",
            body: {
              propertyId: a,
              title: "Test leak",
              description: "Regression fixture",
            },
          }),
          201,
        ).request.id;
        assert(
          !ok(await request("/api/maintenance", { as: "other" })).requests.some(
            (m) => m.id === work,
          ),
        );
        const second = ok(
          await request("/api/leases", {
            method: "POST",
            body: {
              propertyId: a,
              residentName: "Other household",
              residentEmail: people.other.email,
              monthlyRent: 500,
              currency: "USD",
              dueDay: 5,
              startDate: "2026-01-01",
              dueDate: "2026-01-05",
            },
          }),
          201,
        ).lease;
        ok(
          await request("/api/tenancies", {
            method: "PATCH",
            body: { leaseId: second.id, status: "active" },
          }),
        );
        assert(
          !ok(await request("/api/maintenance", { as: "other" })).requests.some(
            (m) => m.id === work,
          ),
        );
        const form = new FormData();
        form.set("propertyId", a);
        form.set("leaseId", lease.id);
        form.set("visibility", "resident");
        form.append(
          "files",
          new Blob(["Private test document"], { type: "text/plain" }),
          "test.txt",
        );
        const doc = ok(
          await request("/api/documents", { method: "POST", body: form }),
          201,
        ).documents[0];
        assert.equal(
          (await request("/api/documents/" + doc.id, { as: "renter" })).status,
          200,
        );
        assert.equal(
          (await request("/api/documents/" + doc.id, { as: "other" })).status,
          403,
        );
        const message = ok(
          await request("/api/messages", {
            as: "renter",
            method: "POST",
            body: { propertyId: a, body: "Private resident question" },
          }),
          201,
        ).message;
        const reply = ok(
          await request("/api/messages", {
            as: "manager",
            method: "POST",
            body: {
              propertyId: a,
              body: "Private staff reply",
              replyTo: message.id,
            },
          }),
          201,
        ).message;
        assert(
          ok(
            await request("/api/messages?experience=personal", {
              as: "renter",
            }),
          ).messages.some((m) => m.id === reply.id),
        );
        assert(
          !ok(
            await request("/api/messages?experience=personal", { as: "other" }),
          ).messages.some((m) => m.id === reply.id),
        );
        assert.equal(
          (
            await request("/api/messages", {
              as: "other",
              method: "POST",
              body: { propertyId: a, body: "IDOR attempt", replyTo: reply.id },
            })
          ).status,
          404,
        );
        ok(
          await request("/api/tenancies", {
            method: "POST",
            body: {
              leaseId: lease.id,
              name: "Roommate",
              email: people.roommate.email,
              relationship: "co_resident",
            },
          }),
          201,
        );
        assert(
          ok(await request("/api/resident", { as: "roommate" })).leases.some(
            (l) => l.id === lease.id,
          ),
        );
        const roommateRequest = ok(
          await request("/api/maintenance", {
            as: "roommate",
            method: "POST",
            body: {
              propertyId: a,
              title: "Roommate request",
              description: "Co-resident regression",
            },
          }),
          201,
        ).request;
        assert(
          ok(
            await request("/api/maintenance?experience=personal", {
              as: "roommate",
            }),
          ).requests.some((r) => r.id === roommateRequest.id),
        );
      },
    );
    await t.test(
      "role permissions constrain leasing, maintenance, and investor access",
      async () => {
        for (const [as, role] of [
          ["leasing", "leasing_agent"],
          ["technician", "maintenance_technician"],
          ["investor", "investor"],
          ["owner", "owner"],
        ]) {
          const id = await invite(as, role);
          ok(
            await request("/api/team", {
              as,
              method: "POST",
              body: { action: "accept", id },
            }),
          );
        }
        assert.equal(
          ok(await request("/api/applications", { as: "technician" }))
            .applications.length,
          0,
        );
        assert.equal(
          ok(await request("/api/leases", { as: "technician" })).leases.length,
          0,
        );
        ok(
          await request("/api/maintenance/" + work, {
            as: "technician",
            method: "PATCH",
            body: { status: "in_progress" },
          }),
        );
        assert.equal(
          (
            await request("/api/leases/" + lease.id + "/payment", {
              as: "leasing",
              method: "POST",
              body: { chargeId: lease.open_charge_id },
            })
          ).status,
          403,
        );
        assert(
          !(
            "balance" in
            ok(await request("/api/leases", { as: "leasing" })).leases.find(
              (l) => l.id === lease.id,
            )
          ),
        );
        assert.equal(
          ok(await request("/api/applications", { as: "investor" }))
            .applications.length,
          0,
        );
        assert.equal(
          ok(await request("/api/leases", { as: "investor" })).leases.length,
          0,
        );
        assert.equal(
          ok(await request("/api/documents", { as: "investor" })).documents
            .length,
          0,
        );
        assert(
          ok(await request("/api/reports", { as: "investor" })).properties.some(
            (p) => p.id === a,
          ),
        );
        assert.equal(
          (
            await request("/api/properties/" + b, {
              as: "owner",
              method: "PATCH",
              body: { status: "published" },
            })
          ).status,
          403,
        );
        const search = ok(
          await request("/api/search?q=Regression", { as: "investor" }),
        ).results;
        assert(search.every((r) => r.tab === "properties"));
      },
    );
    await t.test("payment retry cannot create duplicate receipts", async () => {
      const responses = await Promise.all(
        [1, 2].map(() =>
          request("/api/leases/" + lease.id + "/payment", {
            as: "manager",
            method: "POST",
            body: {
              chargeId: lease.open_charge_id,
              reference: "regression receipt",
            },
          }),
        ),
      );
      assert.equal(responses.filter((r) => r.status === 200).length, 1);
      const portal = ok(await request("/api/resident", { as: "renter" }));
      assert.equal(
        portal.payments.filter((p) => p.lease_id === lease.id).length,
        1,
      );
      assert.equal(portal.balance, 0);
    });
    await t.test(
      "one user can be resident and property owner without mixing personal data",
      async () => {
        const id = await invite("renter", "owner", b);
        ok(
          await request("/api/team", {
            as: "renter",
            method: "POST",
            body: { action: "accept", id },
          }),
        );
        const identity = ok(await request("/api/me", { as: "renter" }));
        assert(identity.contexts.some((p) => p.id === b));
        assert(identity.tenancies.some((p) => p.property_id === a));
        assert(
          !ok(
            await request("/api/applications", { as: "renter" }),
          ).applications.some((p) => p.id === application),
        );
        assert(
          ok(
            await request("/api/applications?experience=personal", {
              as: "renter",
            }),
          ).applications.some((p) => p.id === application),
        );
      },
    );
    await t.test(
      "revocation and role changes take effect immediately",
      async () => {
        ok(
          await request("/api/team", {
            method: "PATCH",
            body: {
              id: assigned.manager.id,
              source: "staff",
              role: "maintenance_technician",
              status: "active",
            },
          }),
        );
        assert.equal(
          ok(await request("/api/applications", { as: "manager" })).applications
            .length,
          0,
        );
        ok(
          await request("/api/team", {
            method: "PATCH",
            body: {
              id: assigned.manager.id,
              source: "staff",
              status: "revoked",
            },
          }),
        );
        assert.equal(
          (
            await request("/api/maintenance/" + work, {
              as: "manager",
              method: "PATCH",
              body: { status: "completed" },
            })
          ).status,
          403,
        );
        assert(
          !ok(
            await request("/api/search?q=Test", { as: "manager" }),
          ).results.some((r) => r.property_id === a),
        );
      },
    );
    await t.test("former residents lose live portal access", async () => {
      for (const status of ["move_out_pending", "former"])
        ok(
          await request("/api/tenancies", {
            method: "PATCH",
            body: { leaseId: lease.id, status },
          }),
        );
      assert.equal(
        ok(await request("/api/resident", { as: "roommate" })).leases.length,
        0,
      );
      assert.equal(
        (
          await request("/api/maintenance", {
            as: "roommate",
            method: "POST",
            body: {
              propertyId: a,
              title: "Not allowed",
              description: "Ended tenancy",
            },
          })
        ).status,
        403,
      );
    });
  },
);
