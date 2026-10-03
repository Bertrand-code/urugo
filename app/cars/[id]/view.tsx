"use client";
import Image from "next/image";
import {
  ActionButton,
  ActionForm,
  type Car,
  ErrorNotice,
  Loading,
  mutate,
  Pill,
  Textarea,
  useResource,
  money,
} from "../../components/products";
export function CarDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useResource<{
    vehicle: Car;
    photos: { id: string; url: string }[];
    saved: boolean;
    canEdit: boolean;
    moderationNote?: string;
  }>("/api/cars/" + id);
  if (error)
    return (
      <main className="product-main">
        <ErrorNotice message={error} retry={reload} />
        <a href="/cars">← Back to cars</a>
      </main>
    );
  if (loading && !data)
    return (
      <main className="product-main">
        <Loading />
      </main>
    );
  if (!data) return null;
  const v = data.vehicle;
  return (
    <main className="product-main">
      <div className="car-detail-heading">
        <a href="/cars" className="product-text-link">
          ← All cars
        </a>
        <div className="product-eyebrow" style={{ marginTop: 28 }}>
          {v.city} · {v.year}
        </div>
        <h1>
          {v.make} {v.model}
        </h1>
        <p className="car-specs">
          {v.mileage.toLocaleString()} km · {v.transmission} · {v.fuel}
        </p>
      </div>
      {v.status !== "published" && (
        <div className="product-notice">
          Private preview · <Pill value={v.status} /> This vehicle is not
          visible in public search.
          {data.moderationNote && <p>Review feedback: {data.moderationNote}</p>}
        </div>
      )}
      <div className="car-detail-layout">
        <div>
          <div className="car-gallery">
            {data.photos.map((p, i) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                <Image
                  src={p.url}
                  alt={`${v.make} ${v.model}, photo ${i + 1}`}
                  width={1000}
                  height={650}
                  unoptimized
                  priority={i === 0}
                />
              </a>
            ))}
          </div>
          {!data.photos.length && (
            <div className="product-empty">
              Vehicle photos have not been added yet.
            </div>
          )}
          <dl className="product-data">
            {[
              ["Year", v.year],
              ["Mileage", v.mileage.toLocaleString() + " km"],
              ["Transmission", v.transmission],
              ["Fuel", v.fuel],
              ["Condition", v.condition],
              ["Location", v.city],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <section className="product-section">
            <h2>About this car</h2>
            <p className="car-detail-description">{v.description}</p>
          </section>
        </div>
        <aside className="car-inquiry-panel">
          <p className="product-eyebrow">ASKING PRICE</p>
          <h2 className="car-price">{money(v.price, v.currency)}</h2>
          <p>
            {v.seller_name} ·{" "}
            {v.seller_type === "dealer" ? "Dealership" : "Private seller"}
          </p>
          {data.canEdit ? (
            <a className="product-button" href="/cars/manage">
              Manage this listing
            </a>
          ) : (
            v.status === "published" && (
              <>
                <div className="product-actions">
                  <ActionButton
                    method="POST"
                    url={`/api/cars/${id}/save`}
                    body={{ saved: !data.saved }}
                    onDone={reload}
                  >
                    {data.saved ? "Remove from saved" : "Save this car"}
                  </ActionButton>
                </div>
                <section className="product-section">
                  <h3>Start a conversation</h3>
                  <p className="product-help">
                    Ask about the car or suggest a viewing time. Check My garage
                    for the seller’s reply.
                  </p>
                  <ActionForm
                    submit="Send inquiry"
                    success="Sent. You can follow the conversation in My garage."
                    reset
                    onSubmit={async (body) => {
                      await mutate(`/api/cars/${id}/inquiries`, body);
                    }}
                  >
                    <Textarea label="Message to seller" name="message" />
                  </ActionForm>
                </section>
              </>
            )
          )}
          <div className="product-notice">
            Meet safely, inspect the vehicle, and verify its documents before
            paying. Urugo does not provide escrow, inspections, or ownership
            guarantees.
          </div>
        </aside>
      </div>
    </main>
  );
}
