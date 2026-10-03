import { CarDetail } from "./view";
import { database } from "@/lib/data";
import {
  publicVehicleColumns,
  vehiclePhoto,
  type Vehicle,
} from "@/lib/products";
import { headers } from "next/headers";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const db = await database(),
    { id } = await params;
  const v = await db
    .prepare(
      `SELECT ${publicVehicleColumns},${vehiclePhoto} FROM vehicles v WHERE v.id=? AND v.status='published'`,
    )
    .bind(id)
    .first<
      Vehicle & { image_url: string | null; city: string; description: string }
    >();
  if (!v)
    return {
      title: "Vehicle preview · Urugo Cars",
      description: "This vehicle is not publicly listed.",
      robots: { index: false, follow: false },
      openGraph: {
        title: "Vehicle preview · Urugo Cars",
        description: "This vehicle is not publicly listed.",
        images: [],
      },
      twitter: {
        title: "Vehicle preview · Urugo Cars",
        description: "This vehicle is not publicly listed.",
        card: "summary",
        images: [],
      },
    };
  const h = await headers(),
    host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000",
    origin =
      (h.get("x-forwarded-proto") ||
        (host.startsWith("localhost") ? "http" : "https")) +
      "://" +
      host;
  const title = `${v.year} ${v.make} ${v.model} in ${v.city} · Urugo Cars`,
    description = v.description.slice(0, 180),
    images = v.image_url
      ? [{ url: origin + v.image_url, alt: `${v.make} ${v.model}` }]
      : [];
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images },
    twitter: {
      title,
      description,
      card: images.length ? "summary_large_image" : "summary",
      images: images.map((i) => i.url),
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CarDetail id={id} />;
}
