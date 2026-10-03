"use client";
import {
  type ReactNode,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";
import Image from "next/image";
import { readJson } from "@/lib/http";

export function ProductNav({ product }: { product: "cars" | "health" }) {
  return (
    <header className="product-nav">
      <a className="product-brand" href={"/" + product}>
        urugo<span>{product}</span>
      </a>
      <nav aria-label="Urugo products">
        <a href="/discover">Homes</a>
        <a href="/cars" aria-current={product === "cars" ? "page" : undefined}>
          Cars
        </a>
        <a
          href="/health"
          aria-current={product === "health" ? "page" : undefined}
        >
          Health
        </a>
      </nav>
      <div className="product-nav-actions">
        {product === "health" ? (
          <>
            <a href="/health/requests">My requests</a>
            <a className="product-button secondary" href="/health/manage">
              Provider workspace
            </a>
          </>
        ) : (
          <a className="product-button secondary" href="/cars/manage">
            My garage · Sell a car
          </a>
        )}
        <a className="product-account" href="/">
          My account
        </a>
      </div>
    </header>
  );
}
export function ProductFooter() {
  return (
    <footer className="product-footer">
      <span>Urugo · For the places, journeys, and care that matter.</span>
      <a href="/contact">Contact Urugo</a>
      <a href="/discover">Find a home</a>
    </footer>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="product-error" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="product-button secondary" onClick={retry}>
          Try again
        </button>
      )}
      {message.toLowerCase().includes("sign in") && (
        <a href="/">Go to account</a>
      )}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="product-empty">
      <span aria-hidden="true">—</span>
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="product-loading" role="status" aria-label="Loading">
      <div />
      <div />
      <div />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
export function Pill({ value }: { value: string }) {
  return (
    <span className={"product-pill state-" + value.replaceAll("_", "-")}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
export function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await readJson<T>(await fetch(url, { cache: "no-store" })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't load this page.");
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
export async function mutate<T = { ok: boolean }>(
  url: string,
  body: unknown,
  method = "POST",
): Promise<T> {
  return readJson<T>(
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
export function ActionButton({
  url,
  body,
  method = "PATCH",
  children,
  onDone,
  confirm,
  danger = false,
}: {
  url: string;
  body: unknown;
  method?: string;
  children: ReactNode;
  onDone?: () => void;
  confirm?: string;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError("");
    try {
      await mutate(url, body, method);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This action failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="product-inline-action">
      <button
        className={"product-button secondary" + (danger ? " danger" : "")}
        disabled={busy}
        onClick={run}
      >
        {busy ? "Saving…" : children}
      </button>
      {error && (
        <span role="alert" className="product-inline-error">
          {error}
        </span>
      )}
    </div>
  );
}
export function ActionForm({
  children,
  onSubmit,
  submit = "Save",
  success = "Saved.",
  reset = false,
}: {
  children: ReactNode;
  onSubmit: (data: Record<string, string>, form: FormData) => Promise<void>;
  submit?: string;
  success?: string;
  reset?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    id = useId();
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget,
      form = new FormData(el);
    setBusy(true);
    setError("");
    setDone(false);
    try {
      await onSubmit(
        Object.fromEntries(
          [...form.entries()].filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
        form,
      );
      setDone(true);
      if (reset) el.reset();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We couldn't save these changes.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="product-form" onSubmit={send} aria-describedby={id}>
      <fieldset disabled={busy}>
        {children}
        <div className="product-form-footer">
          <button className="product-button" disabled={busy}>
            {busy ? "Saving…" : submit}
          </button>
          <span id={id} aria-live="polite">
            {done ? success : ""}
          </span>
        </div>
      </fieldset>
      {error && <ErrorNotice message={error} />}
    </form>
  );
}
export function Input({
  label,
  name,
  type = "text",
  defaultValue,
  required = true,
  maxLength = 200,
  min,
  max,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  maxLength?: number;
  min?: string | number;
  max?: string | number;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Select({
  label,
  name,
  values,
  defaultValue,
}: {
  label: string;
  name: string;
  values: (string | [string, string])[];
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={defaultValue} required>
        {values.map((value) => {
          const [id, name] = Array.isArray(value) ? value : [value, value];
          return (
            <option key={id} value={id}>
              {name.replaceAll("_", " ")}
            </option>
          );
        })}
      </select>
    </label>
  );
}
export function Textarea({
  label,
  name,
  defaultValue,
  maxLength = 1500,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  maxLength?: number;
}) {
  return (
    <label className="full-width">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required
        rows={4}
      />
    </label>
  );
}
export const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
export function dateTime(value: string) {
  const date = new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z",
  );
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Bujumbura",
    }).format(date) + " CAT"
  );
}
export function burundiTime(value: string) {
  return value + ":00+02:00";
}
export type Car = {
  id: string;
  seller_name: string;
  seller_type: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  transmission: string;
  fuel: string;
  condition: string;
  price: number;
  currency: string;
  city: string;
  description: string;
  status: string;
  image_url: string | null;
  moderation_note?: string;
};
export function CarCard({ car }: { car: Car }) {
  return (
    <article className="car-card">
      <a className="car-card-image" href={"/cars/" + car.id}>
        {car.image_url ? (
          <Image
            src={car.image_url}
            alt={`${car.year} ${car.make} ${car.model}`}
            width={700}
            height={460}
            unoptimized
          />
        ) : (
          <span>Vehicle photos pending</span>
        )}
        <span className="car-condition">{car.condition}</span>
      </a>
      <div className="car-card-body">
        <div className="product-eyebrow">
          {car.city} ·{" "}
          {car.seller_type === "dealer" ? "Dealer listing" : "Private seller"}
        </div>
        <h3>
          <a href={"/cars/" + car.id}>
            {car.make} {car.model}
          </a>
        </h3>
        <p className="car-specs">
          {car.year} <span>·</span> {car.mileage.toLocaleString()} km{" "}
          <span>·</span> {car.transmission}
        </p>
        <div className="car-card-bottom">
          <strong>{money(car.price, car.currency)}</strong>
          <a
            href={"/cars/" + car.id}
            aria-label={`View ${car.make} ${car.model}`}
          >
            View car ↗
          </a>
        </div>
      </div>
    </article>
  );
}
