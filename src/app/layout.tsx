import type { Metadata, Viewport } from "next";
import { Heebo, Secular_One } from "next/font/google";
import "./globals.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"] });
const secular = Secular_One({ variable: "--font-secular", subsets: ["hebrew", "latin"], weight: "400" });

export const metadata: Metadata = {
  title: "הברכה שלך לכרמל",
  description: "תכתבו ברכה, וה-AI יהפוך אותה לפוסטר או לשיר אישי",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#070b1f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${secular.variable} antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
