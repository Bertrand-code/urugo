import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Urugo — Property operations, made clear",
  description: "Property operations, applications, and access control for homes in Burundi.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
