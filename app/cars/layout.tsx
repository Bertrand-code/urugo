import type { Metadata } from "next";
import { ProductNav, ProductFooter } from "../components/products";
import "../products.css";
export const metadata: Metadata = {
  title: "Urugo Cars — Your next journey starts here",
  description:
    "Browse vehicles in Burundi, save your shortlist, and connect with sellers. List your car with Urugo.",
  openGraph: {
    title: "Urugo Cars",
    description: "Find your next car in Burundi.",
    images: [],
  },
  twitter: { card: "summary", title: "Urugo Cars", images: [] },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="product-shell">
      <ProductNav product="cars" />
      {children}
      <ProductFooter />
    </div>
  );
}
