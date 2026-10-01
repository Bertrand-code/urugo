import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Urugo — Home, made simple",
  description: "A calm, connected property and resident portal experience for Burundi.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
