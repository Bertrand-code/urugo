import type { Metadata } from "next";
import { headers } from "next/headers";
import { database } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const id = (await params).id.slice(0, 100);
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const base = protocol + "://" + host;
  const property = await (await database())
    .prepare(
      "SELECT name, neighborhood, city, kind, listing_type, price_amount, currency, bedrooms, bathrooms, description FROM properties WHERE id = ? AND status = 'published' AND NOT EXISTS (SELECT 1 FROM listing_details d WHERE d.property_id=properties.id AND d.publication!='published')",
    )
    .bind(id)
    .first<{
      name: string;
      neighborhood: string;
      city: string;
      kind: string;
      listing_type: "rent" | "sale";
      price_amount: number;
      currency: string;
      bedrooms: number;
      bathrooms: number;
      description: string;
    }>();
  if (!property)
    return {
      title: "Listing unavailable | Urugo",
      description: "This listing is unavailable.",
      openGraph: { images: [] },
      twitter: { images: [] },
    };
  const image = await (await database())
    .prepare(
      "SELECT id FROM property_images WHERE property_id = ? ORDER BY sort_order LIMIT 1",
    )
    .bind(id)
    .first<{ id: string }>();
  const price = property.price_amount
    ? new Intl.NumberFormat("en", {
        style: "currency",
        currency: property.currency,
        maximumFractionDigits: 0,
      }).format(property.price_amount)
    : "Price on request";
  const title = property.name + " | Urugo";
  const description =
    property.description ||
    property.kind +
      " in " +
      property.neighborhood +
      ", " +
      property.city +
      ". " +
      price +
      (property.listing_type === "rent" ? " per month." : ".");
  const images = image
    ? [{ url: base + "/api/media/" + image.id, alt: property.name }]
    : [];
  return {
    title,
    description,
    openGraph: { title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default function ListingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
