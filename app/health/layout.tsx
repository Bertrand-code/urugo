import type { Metadata } from "next";
import { ProductNav, ProductFooter } from "../components/products";
import "../products.css";
export const metadata: Metadata = {
  title: "Urugo Health — Check before you travel",
  description:
    "Find participating pharmacies and clinics in Burundi. Request medicine availability confirmation or an appointment before making the trip.",
  openGraph: {
    title: "Urugo Health",
    description: "Find participating pharmacies and clinics in Burundi.",
    images: [],
  },
  twitter: { card: "summary", title: "Urugo Health", images: [] },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="product-shell">
      <ProductNav product="health" />
      {children}
      <ProductFooter />
    </div>
  );
}
