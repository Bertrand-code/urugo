import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const image = protocol + "://" + host + "/og.png";
  const title = "Urugo — Homes, residents, and operations together";
  const description =
    "Discover homes, process applications, and manage resident operations in one clear workspace.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Urugo",
      images: [
        {
          url: image,
          width: 1734,
          height: 909,
          alt: "Urugo property marketplace and resident management",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
