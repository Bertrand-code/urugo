import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

const base = process.env.URUGO_TEST_URL,
  dbPath = process.env.URUGO_TEST_DB;
const enabled = Boolean(base && dbPath);
if (
  enabled &&
  (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base) ||
    !resolve(dbPath).startsWith(resolve(".wrangler/state/v3/d1") + "/"))
)
  throw new Error(
    "Product integration tests require the explicit local URL and local preview D1 path.",
  );
const run = "urugo-product-regression-" + Date.now();
const people = Object.fromEntries(
  ["seller", "buyer", "other", "provider", "clinic", "staff"].map((name) => [
    name,
    { id: run + "-" + name, email: run + "-" + name + "@example.invalid" },
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
const ok = (r, status = 200) => {
  assert.equal(r.status, status, JSON.stringify(r.data));
  return r.data;
};
const post = (path, body, as) => request(path, { as, method: "POST", body });
const patch = (path, body, as) => request(path, { as, method: "PATCH", body });

test(
  "Cars and Health end-to-end boundaries and request lifecycles",
  { skip: !enabled },
  async (t) => {
    const cars = [],
      facilities = [];
    const local = new DatabaseSync(dbPath);
    local.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    // Cleanup touches only IDs returned by this test, additionally checking their
    // synthetic owners. It never removes real inventory or patient records.
    t.after(async () => {
      for (const id of cars) {
        const row = local
          .prepare("SELECT seller_id FROM vehicles WHERE id=?")
          .get(id);
        assert.equal(row?.seller_id, people.seller.id);
        await patch(
          "/api/cars/" + id,
          { action: "status", status: "draft" },
          "seller",
        );
        const detail = ok(await request("/api/cars/" + id, { as: "seller" }));
        for (const photo of detail.photos)
          ok(
            await request("/api/cars/photos/" + photo.id, {
              as: "seller",
              method: "DELETE",
            }),
          );
        local
          .prepare("DELETE FROM vehicles WHERE id=? AND seller_id=?")
          .run(id, people.seller.id);
      }
      for (const id of facilities) {
        const row = local
          .prepare("SELECT owner_id FROM health_facilities WHERE id=?")
          .get(id);
        assert(Object.values(people).some((p) => p.id === row?.owner_id));
        local
          .prepare(
            "DELETE FROM medicine_requests WHERE inventory_id IN(SELECT id FROM medicine_inventory WHERE facility_id=?)",
          )
          .run(id);
        local
          .prepare(
            "DELETE FROM health_appointments WHERE slot_id IN(SELECT id FROM appointment_slots WHERE facility_id=?)",
          )
          .run(id);
        local.prepare("DELETE FROM health_facilities WHERE id=?").run(id);
      }
      local.close();
    });
    for (const as of Object.keys(people)) ok(await request("/api/me", { as }));
    const carBody = {
      seller_name: "URUGO REGRESSION seller",
      seller_type: "private",
      make: "Test Make",
      model: "Test Model",
      year: 2024,
      mileage: 1000,
      transmission: "automatic",
      fuel: "petrol",
      condition: "used",
      price: 12000,
      currency: "USD",
      city: "REGRESSION CITY",
      description: "Disposable integration test listing. Not real inventory.",
    };
    const car = ok(await post("/api/cars", carBody, "seller"), 201).id;
    cars.push(car);
    await t.test(
      "car drafts, IDs, inputs and uploads are protected",
      async () => {
        assert.equal(
          (await request("/api/cars/" + car, { as: "buyer" })).status,
          404,
        );
        assert.equal(
          (
            await patch(
              "/api/cars/" + car,
              { action: "status", status: "pending" },
              "other",
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await patch(
              "/api/cars/" + car,
              { action: "status", status: "pending" },
              "seller",
            )
          ).status,
          400,
        );
        assert.equal(
          (await post("/api/cars", { ...carBody, price: -1 }, "seller")).status,
          400,
        );
        assert.equal(
          (await post("/api/cars", { ...carBody, year: 1900.5 }, "seller"))
            .status,
          400,
        );
        const bad = new FormData();
        bad.append(
          "files",
          new Blob(["<script>not an image</script>"], { type: "image/png" }),
          "fake.png",
        );
        assert.equal(
          (await post(`/api/cars/${car}/photos`, bad, "seller")).status,
          400,
        );
        const photos = new FormData();
        photos.append(
          "files",
          new Blob(
            [
              Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=",
                "base64",
              ),
            ],
            { type: "image/png" },
          ),
          "test.png",
        );
        ok(await post(`/api/cars/${car}/photos`, photos, "seller"), 201);
        const photo = ok(await request("/api/cars/" + car, { as: "seller" }))
          .photos[0];
        assert.equal((await request(photo.url, { as: "other" })).status, 404);
      },
    );
    await t.test(
      "review publishes a minimal public listing; only sellers see buyer inquiries",
      async () => {
        ok(
          await patch(
            "/api/cars/" + car,
            { action: "status", status: "pending" },
            "seller",
          ),
        );
        assert.equal(
          (
            await patch(
              "/api/cars/" + car,
              { action: "moderate", status: "published" },
              "seller",
            )
          ).status,
          403,
        );
        ok(
          await patch("/api/cars/" + car, {
            action: "moderate",
            status: "published",
          }),
        );
        const published = ok(
          await request("/api/cars?q=REGRESSION", { as: "other" }),
        ).vehicles.find((v) => v.id === car);
        assert(published);
        for (const key of [
          "seller_id",
          "moderation_note",
          "email",
          "storage_key",
        ])
          assert(!(key in published));
        const detail = ok(await request("/api/cars/" + car, { as: "buyer" }));
        assert.equal(detail.canEdit, false);
        assert.equal(detail.moderationNote, undefined);
        const photo = await request(detail.photos[0].url, { as: "buyer" });
        assert.equal(photo.status, 200);
        assert.equal(photo.headers.get("x-content-type-options"), "nosniff");
        ok(await post(`/api/cars/${car}/save`, { saved: true }, "buyer"));
        assert(
          ok(await request("/api/cars/me", { as: "buyer" })).saved.some(
            (v) => v.id === car,
          ),
        );
        const inquiry = ok(
          await post(
            `/api/cars/${car}/inquiries`,
            { message: "Can I arrange a viewing?", buyer_id: people.other.id },
            "buyer",
          ),
          201,
        ).id;
        assert.equal(
          (
            await post(
              `/api/cars/${car}/inquiries`,
              { message: "Duplicate" },
              "buyer",
            )
          ).status,
          409,
        );
        assert(
          !ok(await request("/api/cars/me", { as: "other" })).inquiries.some(
            (i) => i.id === inquiry,
          ),
        );
        assert(
          !ok(await request("/api/cars/me")).inquiries.some(
            (i) => i.id === inquiry,
          ),
        );
        assert.equal(
          (
            await patch(
              "/api/cars/inquiries/" + inquiry,
              { action: "reply", reply: "Unauthorized" },
              "other",
            )
          ).status,
          404,
        );
        ok(
          await patch(
            "/api/cars/inquiries/" + inquiry,
            { action: "reply", reply: "Yes. Let's arrange a viewing." },
            "seller",
          ),
        );
        assert.match(
          ok(await request("/api/cars/me", { as: "buyer" })).inquiries.find(
            (i) => i.id === inquiry,
          ).reply,
          /viewing/,
        );
        // Record-specific metadata, never the Homes social card.
        const html = (await request("/cars/" + car, { as: "buyer" })).data;
        for (const value of [
          "2024 Test Make Test Model",
          "REGRESSION CITY",
          detail.photos[0].url,
        ])
          assert(html.includes(value));
        assert(
          !html.includes(
            'property="og:image" content="https://localhost:3000/og.png"',
          ),
        );
        ok(
          await patch(
            "/api/cars/" + car,
            { action: "status", status: "sold" },
            "seller",
          ),
        );
        assert.equal(
          (await request("/api/cars/" + car, { as: "buyer" })).status,
          404,
        );
      },
    );
    const fbody = {
      name: "URUGO REGRESSION Pharmacy",
      kind: "pharmacy",
      city: "REGRESSION CITY",
      address: "TEST ONLY",
      phone: "000-TEST",
      hours: "Test hours",
      license: "TEST-NOT-A-LICENCE",
    };
    const pharmacy = ok(
      await post("/api/health/facilities", fbody, "provider"),
      201,
    ).id;
    facilities.push(pharmacy);
    const clinic = ok(
      await post(
        "/api/health/facilities",
        { ...fbody, name: "URUGO REGRESSION Clinic", kind: "clinic" },
        "clinic",
      ),
      201,
    ).id;
    facilities.push(clinic);
    const medicine = ok(
      await post(
        "/api/health/inventory",
        {
          facility_id: pharmacy,
          name: "REGRESSION TEST MEDICINE",
          generic_name: "TEST ONLY",
          strength: "TEST STRENGTH",
          form: "TEST FORM",
          availability: "available",
        },
        "provider",
      ),
      201,
    ).id;
    await t.test(
      "provider verification is deliberate; public search contains no private business or patient data",
      async () => {
        assert(
          !ok(await request("/api/health/search")).facilities.some(
            (f) => f.id === pharmacy,
          ),
        );
        assert.equal(
          (
            await post(
              "/api/health/requests",
              { inventory_id: medicine },
              "buyer",
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await patch(
              "/api/health/facilities/" + pharmacy,
              {
                action: "review",
                status: "verified",
                note: "Self verify",
                attested: true,
              },
              "provider",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await patch("/api/health/facilities/" + pharmacy, {
              action: "review",
              status: "verified",
              note: "Missing attestation",
            })
          ).status,
          400,
        );
        for (const id of [pharmacy, clinic])
          ok(
            await patch("/api/health/facilities/" + id, {
              action: "review",
              status: "verified",
              note: "Synthetic test fixture, removed after regression.",
              attested: true,
            }),
          );
        const pub = ok(await request("/api/health/search?q=REGRESSION"));
        assert(pub.inventory.some((i) => i.id === medicine));
        const provider = pub.facilities.find((f) => f.id === pharmacy);
        assert(provider);
        for (const key of ["owner_id", "license", "review_note", "verified_by"])
          assert(!(key in provider));
        assert.equal(
          (
            await post(
              "/api/health/inventory",
              { facility_id: pharmacy, name: "Not allowed" },
              "other",
            )
          ).status,
          404,
        );
        local
          .prepare(
            "UPDATE medicine_inventory SET updated_at=datetime('now','-2 days') WHERE id=?",
          )
          .run(medicine);
        assert.equal(
          ok(await request("/api/health/search?q=REGRESSION")).inventory.find(
            (i) => i.id === medicine,
          ).stale,
          1,
        );
      },
    );
    let pharmacyRequest;
    await t.test(
      "patient requests are isolated from unrelated users and platform/property administrators",
      async () => {
        pharmacyRequest = ok(
          await post(
            "/api/health/requests",
            { inventory_id: medicine, patient_id: people.other.id },
            "buyer",
          ),
          201,
        ).id;
        assert.equal(
          (
            await post(
              "/api/health/requests",
              { inventory_id: medicine },
              "buyer",
            )
          ).status,
          409,
        );
        assert(
          ok(await request("/api/health/me", { as: "buyer" })).mine.some(
            (r) => r.id === pharmacyRequest,
          ),
        );
        assert(
          !ok(await request("/api/health/me", { as: "other" })).mine.some(
            (r) => r.id === pharmacyRequest,
          ),
        );
        assert(
          !ok(await request("/api/health/me")).requests.some(
            (r) => r.id === pharmacyRequest,
          ),
        );
        assert.equal(
          (
            await patch(
              "/api/health/requests/" + pharmacyRequest,
              { status: "confirmed" },
              "buyer",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await patch(
              "/api/health/requests/" + pharmacyRequest,
              { status: "cancelled" },
              "other",
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await patch("/api/health/requests/" + pharmacyRequest, {
              status: "confirmed",
            })
          ).status,
          404,
        );
        assert.equal(
          ok(await request("/api/health/me", { as: "provider" })).requests.find(
            (r) => r.id === pharmacyRequest,
          ).patient_name,
          people.buyer.email.split("@")[0],
        );
      },
    );
    await t.test(
      "explicit provider team access is scoped and revocation takes effect immediately",
      async () => {
        ok(
          await post(
            "/api/health/team",
            { facility_id: pharmacy, email: people.staff.email },
            "provider",
          ),
          201,
        );
        assert(
          ok(await request("/api/health/me", { as: "staff" })).requests.some(
            (r) => r.id === pharmacyRequest,
          ),
        );
        assert(
          !ok(await request("/api/health/me", { as: "staff" })).facilities.some(
            (f) => f.id === clinic,
          ),
        );
        assert.equal(
          (
            await post(
              "/api/health/team",
              { facility_id: pharmacy, email: people.other.email },
              "staff",
            )
          ).status,
          403,
        );
        const member = ok(
          await request("/api/health/me", { as: "provider" }),
        ).staff.find((s) => s.email === people.staff.email);
        ok(
          await patch(
            "/api/health/team/" + member.id,
            { status: "revoked" },
            "provider",
          ),
        );
        assert(
          !ok(await request("/api/health/me", { as: "staff" })).requests.some(
            (r) => r.id === pharmacyRequest,
          ),
        );
        assert.equal(
          (
            await patch(
              "/api/health/requests/" + pharmacyRequest,
              { status: "confirmed" },
              "staff",
            )
          ).status,
          404,
        );
      },
    );
    await t.test(
      "pharmacy confirmation has an expiring collection window, never a perpetual stock promise",
      async () => {
        assert.equal(
          (
            await patch(
              "/api/health/requests/" + pharmacyRequest,
              {
                status: "confirmed",
                hold_until: new Date(Date.now() - 1000).toISOString(),
              },
              "provider",
            )
          ).status,
          400,
        );
        ok(
          await patch(
            "/api/health/requests/" + pharmacyRequest,
            {
              status: "confirmed",
              hold_until: new Date(Date.now() + 3600000).toISOString(),
            },
            "provider",
          ),
        );
        assert.equal(
          ok(await request("/api/health/me", { as: "buyer" })).mine.find(
            (r) => r.id === pharmacyRequest,
          ).status,
          "confirmed",
        );
        local
          .prepare(
            "UPDATE medicine_requests SET hold_until=datetime('now','-1 minute') WHERE id=?",
          )
          .run(pharmacyRequest);
        assert.equal(
          ok(await request("/api/health/me", { as: "buyer" })).mine.find(
            (r) => r.id === pharmacyRequest,
          ).status,
          "expired",
        );
        assert.equal(
          (
            await patch(
              "/api/health/requests/" + pharmacyRequest,
              { status: "collected" },
              "provider",
            )
          ).status,
          409,
        );
      },
    );
    let slot, booking;
    await t.test(
      "appointments prevent overlaps and simultaneous double booking",
      async () => {
        const start = Date.now() + 86400000,
          end = start + 1800000;
        const slotBody = {
          facility_id: clinic,
          service: "TEST CONSULTATION",
          practitioner: "TEST PRACTITIONER",
          starts_at: new Date(start).toISOString(),
          ends_at: new Date(end).toISOString(),
        };
        slot = ok(await post("/api/health/slots", slotBody, "clinic"), 201).id;
        assert.equal(
          (
            await post(
              "/api/health/slots",
              { ...slotBody, starts_at: new Date(start + 60000).toISOString() },
              "clinic",
            )
          ).status,
          409,
        );
        const attempts = await Promise.all([
          post("/api/health/appointments", { slot_id: slot }, "buyer"),
          post("/api/health/appointments", { slot_id: slot }, "other"),
        ]);
        assert.deepEqual(attempts.map((a) => a.status).sort(), [201, 409]);
        booking = attempts.find((a) => a.status === 201).data.id;
        assert(
          !ok(await request("/api/health/search")).slots.some(
            (s) => s.id === slot,
          ),
        );
        assert.equal(
          (
            await patch(
              "/api/health/appointments/" + booking,
              { status: "confirmed" },
              "provider",
            )
          ).status,
          404,
        );
        ok(
          await patch(
            "/api/health/appointments/" + booking,
            { status: "confirmed" },
            "clinic",
          ),
        );
        assert.equal(
          (
            await patch(
              "/api/health/appointments/" + booking,
              { status: "completed" },
              "clinic",
            )
          ).status,
          400,
        );
        ok(
          await patch(
            "/api/health/slots/" + slot,
            { status: "closed" },
            "clinic",
          ),
        );
        assert.equal(
          ok(
            await request("/api/health/me", { as: "clinic" }),
          ).appointments.find((b) => b.id === booking).status,
          "cancelled",
        );
        assert.equal(
          (await post("/api/health/appointments", { slot_id: slot }, "buyer"))
            .status,
          409,
        );
      },
    );
    await t.test(
      "suspension removes public inventory and cancels outstanding requests",
      async () => {
        const r = ok(
          await post(
            "/api/health/requests",
            { inventory_id: medicine },
            "buyer",
          ),
          201,
        ).id;
        ok(
          await patch("/api/health/facilities/" + pharmacy, {
            action: "review",
            status: "suspended",
            note: "Fixture suspension",
          }),
        );
        assert(
          !ok(await request("/api/health/search")).inventory.some(
            (i) => i.id === medicine,
          ),
        );
        assert.equal(
          ok(await request("/api/health/me", { as: "buyer" })).mine.find(
            (m) => m.id === r,
          ).status,
          "cancelled",
        );
        assert.equal(
          (
            await post(
              "/api/health/requests",
              { inventory_id: medicine },
              "buyer",
            )
          ).status,
          404,
        );
      },
    );
    await t.test(
      "new screens render and the rental marketplace still responds",
      async () => {
        for (const path of [
          "/cars",
          "/cars/manage",
          "/health",
          "/health/manage",
          "/health/requests",
          "/discover",
        ]) {
          const response = await request(path);
          assert.equal(response.status, 200, path);
        }
      },
    );
  },
);
