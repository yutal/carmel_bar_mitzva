import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre, Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });
const frank = Frank_Ruhl_Libre({ variable: "--font-frank", subsets: ["hebrew", "latin"], weight: ["500", "700", "900"] });

export const metadata: Metadata = {
  title: "הברכה שלך לכרמל",
  description: "תכתבו ברכה, וה-AI יהפוך אותה לפוסטר או לשיר אישי",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f6ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${frank.variable} antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
