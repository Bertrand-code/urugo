"use client";
import { useState } from "react";
import Image from "next/image";
import {
  ActionButton,
  ActionForm,
  CarCard,
  type Car,
  Empty,
  ErrorNotice,
  Input,
  Loading,
  mutate,
  Pill,
  Select,
  Textarea,
  useResource,
  money,
} from "../../components/products";
import { readJson } from "@/lib/http";
type Inquiry = {
  id: string;
  vehicle_id: string;
  buyer_name: string;
  message: string;
  reply: string;
  status: string;
  can_reply: number;
  make: string;
  model: string;
  year: number;
};
type Workspace = {
  vehicles: Car[];
  saved: Car[];
  review: Car[];
  inquiries: Inquiry[];
  isAdmin: boolean;
};
function CarFields({ car }: { car?: Car }) {
  return (
    <div className="product-form-grid">
      <Input
        label="Seller / business display name"
        name="seller_name"
        defaultValue={car?.seller_name}
        maxLength={120}
      />
      <Select
        label="Selling as"
        name="seller_type"
        values={[
          ["private", "Private seller"],
          ["dealer", "Dealership"],
        ]}
        defaultValue={car?.seller_type}
      />
      <Input
        label="Make"
        name="make"
        defaultValue={car?.make}
        placeholder="Toyota"
        maxLength={60}
      />
      <Input
        label="Model"
        name="model"
        defaultValue={car?.model}
        placeholder="RAV4"
        maxLength={80}
      />
      <Input
        label="Year"
        name="year"
        type="number"
        min="1900"
        max={new Date().getFullYear() + 1}
        defaultValue={car?.year}
      />
      <Input
        label="Mileage (km)"
        name="mileage"
        type="number"
        min="0"
        max="3000000"
        defaultValue={car?.mileage}
      />
      <Select
        label="Transmission"
        name="transmission"
        values={["automatic", "manual"]}
        defaultValue={car?.transmission}
      />
      <Select
        label="Fuel"
        name="fuel"
        values={["petrol", "diesel", "hybrid", "electric"]}
        defaultValue={car?.fuel}
      />
      <Select
        label="Condition"
        name="condition"
        values={["used", "new"]}
        defaultValue={car?.condition}
      />
      <Input
        label="City / town"
        name="city"
        defaultValue={car?.city}
        maxLength={100}
      />
      <Input
        label="Asking price (whole currency units)"
        name="price"
        type="number"
        min="1"
        max="100000000000"
        defaultValue={car?.price}
      />
      <Select
        label="Currency"
        name="currency"
        values={["BIF", "USD"]}
        defaultValue={car?.currency}
      />
      <Textarea
        label="Describe the car, its history, and any known faults"
        name="description"
        maxLength={3000}
        defaultValue={car?.description}
      />
    </div>
  );
}
function PhotoEditor({ id, onDone }: { id: string; onDone: () => void }) {
  const { data, error, reload } = useResource<{
    photos: { id: string; url: string }[];
  }>("/api/cars/" + id);
  async function refresh() {
    await reload();
    onDone();
  }
  return (
    <div className="product-panel">
      <h3>Vehicle photographs</h3>
      <p>
        Use your own photos of this vehicle. JPEG, PNG or WebP, up to 8 MB each.
        Twelve photos maximum.
      </p>
      {error && <ErrorNotice message={error} />}
      <div className="product-photo-tools">
        {data?.photos.map((p, i) => (
          <div key={p.id}>
            <Image
              src={p.url}
              width={150}
              height={100}
              alt={`Vehicle photo ${i + 1}`}
              unoptimized
            />
            <ActionButton
              url={"/api/cars/photos/" + p.id}
              method="DELETE"
              body={{}}
              confirm="Remove this vehicle photo?"
              onDone={refresh}
            >
              Remove
            </ActionButton>
          </div>
        ))}
      </div>
      <ActionForm
        submit="Upload photos"
        success="Photos saved. Submit your listing for review when ready."
        reset
        onSubmit={async (_, form) => {
          await readJson(
            await fetch(`/api/cars/${id}/photos`, {
              method: "POST",
              body: form,
            }),
          );
          await refresh();
        }}
      >
        <label>
          Add up to six photos
          <input
            name="files"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            required
          />
        </label>
      </ActionForm>
    </div>
  );
}
export default function Garage() {
  const { data, error, loading, reload } =
      useResource<Workspace>("/api/cars/me"),
    [photos, setPhotos] = useState("");
  return (
    <main className="product-main">
      <section className="product-hero">
        <div>
          <div className="product-eyebrow">YOUR CARS WORKSPACE</div>
          <h1>
            Make room for
            <br />
            the next journey.
          </h1>
          <p>
            Your listings, your shortlist, and your conversations with buyers
            and sellers—all in one garage.
          </p>
        </div>
        <aside className="product-hero-note">
          <strong>Three steps to a listing.</strong>
          <p>
            1. Save the vehicle details.
            <br />
            2. Add real photographs.
            <br />
            3. Submit for publication review.
          </p>
          <a className="product-text-link" href="/cars">
            Browse cars ↗
          </a>
        </aside>
      </section>
      {error ? (
        <ErrorNotice message={error} retry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <details className="product-details">
              <summary>+ List a vehicle</summary>
              <div>
                <ActionForm
                  submit="Save vehicle draft"
                  success="Draft saved below. Add photos, then submit for review."
                  reset
                  onSubmit={async (body) => {
                    const r = await mutate<{ id: string }>("/api/cars", body);
                    setPhotos(r.id);
                    await reload();
                  }}
                >
                  <CarFields />
                </ActionForm>
              </div>
            </details>
            <section className="product-section">
              <h2>My listings</h2>
              {!data.vehicles.length ? (
                <Empty title="Your garage is ready">
                  <p>
                    Add a vehicle above to start your first listing. Drafts are
                    only visible to you and platform reviewers.
                  </p>
                </Empty>
              ) : (
                data.vehicles.map((car) => (
                  <article className="product-panel" key={car.id}>
                    <div className="product-heading-row">
                      <div>
                        <h3>
                          {car.year} {car.make} {car.model}
                        </h3>
                        <p>
                          {money(car.price, car.currency)} · {car.city}
                        </p>
                      </div>
                      <Pill value={car.status} />
                    </div>
                    {car.moderation_note && (
                      <div className="product-notice">
                        Review feedback: {car.moderation_note}
                      </div>
                    )}
                    <div className="product-actions">
                      <a
                        className="product-button secondary"
                        href={"/cars/" + car.id}
                      >
                        Preview listing
                      </a>
                      {car.status === "draft" && (
                        <>
                          <button
                            className="product-button secondary"
                            onClick={() =>
                              setPhotos(photos === car.id ? "" : car.id)
                            }
                          >
                            Manage photos
                          </button>
                          <ActionButton
                            url={"/api/cars/" + car.id}
                            body={{ action: "status", status: "pending" }}
                            onDone={() => {
                              setPhotos("");
                              void reload();
                            }}
                          >
                            Submit for review
                          </ActionButton>
                        </>
                      )}
                      {car.status !== "draft" && (
                        <ActionButton
                          url={"/api/cars/" + car.id}
                          body={{ action: "status", status: "draft" }}
                          confirm="Return to draft? This hides the vehicle from public search until reviewed again."
                          onDone={reload}
                        >
                          Return to draft
                        </ActionButton>
                      )}
                      {car.status === "published" && (
                        <ActionButton
                          url={"/api/cars/" + car.id}
                          body={{ action: "status", status: "sold" }}
                          confirm="Mark this car as sold and remove it from public listings?"
                          onDone={reload}
                        >
                          Mark sold
                        </ActionButton>
                      )}
                      {!["archived", "sold"].includes(car.status) && (
                        <ActionButton
                          url={"/api/cars/" + car.id}
                          body={{ action: "status", status: "archived" }}
                          onDone={reload}
                          confirm="Archive this listing? Its inquiries will be preserved."
                        >
                          Archive
                        </ActionButton>
                      )}
                    </div>
                    {photos === car.id && car.status === "draft" && (
                      <PhotoEditor id={car.id} onDone={reload} />
                    )}
                    <details className="product-details">
                      <summary>Edit vehicle details</summary>
                      <div>
                        <p className="product-help">
                          Saving changes returns this listing to draft for a
                          fresh review.
                        </p>
                        <ActionForm
                          submit="Save changes as draft"
                          onSubmit={async (body) => {
                            await mutate(
                              "/api/cars/" + car.id,
                              { ...body, action: "edit" },
                              "PATCH",
                            );
                            await reload();
                          }}
                        >
                          <CarFields car={car} />
                        </ActionForm>
                      </div>
                    </details>
                  </article>
                ))
              )}
            </section>
            <section className="product-section">
              <h2>Conversations</h2>
              {!data.inquiries.length ? (
                <Empty title="Your next conversation starts with a car">
                  <p>
                    Buyer questions and seller replies appear here. You won’t
                    need to publish your contact details.
                  </p>
                </Empty>
              ) : (
                data.inquiries.map((i) => (
                  <article className="product-panel" key={i.id}>
                    <div className="product-heading-row">
                      <h3>
                        <a href={"/cars/" + i.vehicle_id}>
                          {i.year} {i.make} {i.model}
                        </a>
                      </h3>
                      <Pill value={i.status} />
                    </div>
                    <p>
                      <strong>
                        {i.can_reply ? i.buyer_name : "Your question"}
                      </strong>
                      <br />
                      {i.message}
                    </p>
                    {i.reply && (
                      <div className="product-notice">
                        <strong>Seller’s reply</strong>
                        <br />
                        {i.reply}
                      </div>
                    )}
                    {i.can_reply === 1 && i.status !== "closed" && (
                      <ActionForm
                        submit="Send reply"
                        onSubmit={async (body) => {
                          await mutate(
                            "/api/cars/inquiries/" + i.id,
                            { ...body, action: "reply" },
                            "PATCH",
                          );
                          await reload();
                        }}
                      >
                        <Textarea
                          label="Reply to buyer"
                          name="reply"
                          defaultValue={i.reply}
                        />
                      </ActionForm>
                    )}
                    {i.status !== "closed" && (
                      <div className="product-actions">
                        <ActionButton
                          url={"/api/cars/inquiries/" + i.id}
                          body={{ action: "close" }}
                          onDone={reload}
                        >
                          Close conversation
                        </ActionButton>
                      </div>
                    )}
                  </article>
                ))
              )}
            </section>
            <section className="product-section">
              <h2>Saved cars</h2>
              {!data.saved.length ? (
                <Empty title="Keep your shortlist here">
                  <p>
                    Save a car while browsing to make it easier to compare
                    later. Sold or unpublished cars leave this list.
                  </p>
                  <a href="/cars" className="product-button secondary">
                    Browse vehicles
                  </a>
                </Empty>
              ) : (
                <div className="product-grid">
                  {data.saved.map((car) => (
                    <div key={car.id}>
                      <CarCard car={car} />
                      <div className="product-actions">
                        <ActionButton
                          method="POST"
                          url={`/api/cars/${car.id}/save`}
                          body={{ saved: false }}
                          onDone={reload}
                        >
                          Remove from saved
                        </ActionButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {data.isAdmin && (
              <section className="product-section">
                <h2>Publication review</h2>
                <p className="product-help">
                  Check photos, listing accuracy, seller details and
                  inappropriate content. Publication review is not an inspection
                  or ownership certification.
                </p>
                {!data.review.length ? (
                  <Empty title="No listings to review">
                    <p>
                      Seller submissions will arrive here. Published listings
                      can also be withdrawn here.
                    </p>
                  </Empty>
                ) : (
                  data.review.map((car) => (
                    <article className="product-panel" key={car.id}>
                      <div className="product-heading-row">
                        <h3>
                          {car.year} {car.make} {car.model} · {car.seller_name}
                        </h3>
                        <Pill value={car.status} />
                      </div>
                      <div className="product-actions">
                        <a
                          className="product-button secondary"
                          href={"/cars/" + car.id}
                        >
                          Review full listing & photos
                        </a>
                        {car.status === "pending" && (
                          <ActionButton
                            url={"/api/cars/" + car.id}
                            body={{ action: "moderate", status: "published" }}
                            confirm="Have you reviewed the listing and photos for publication?"
                            onDone={reload}
                          >
                            Approve publication
                          </ActionButton>
                        )}
                      </div>
                      <details className="product-details">
                        <summary>Return to seller / withdraw listing</summary>
                        <div>
                          <ActionForm
                            submit="Return to draft"
                            onSubmit={async (body) => {
                              await mutate(
                                "/api/cars/" + car.id,
                                {
                                  ...body,
                                  action: "moderate",
                                  status: "draft",
                                },
                                "PATCH",
                              );
                              await reload();
                            }}
                          >
                            <Textarea
                              label="Reason / feedback to seller"
                              name="note"
                              maxLength={500}
                            />
                          </ActionForm>
                        </div>
                      </details>
                    </article>
                  ))
                )}
              </section>
            )}
          </>
        )
      )}
    </main>
  );
}
